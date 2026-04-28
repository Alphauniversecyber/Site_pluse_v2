import "server-only";

import { getPlanLabel } from "@/lib/admin/format";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getLocalDayKey, getPeriodKey, isDueForPeriod, normalizeTimezone } from "@/lib/schedule-monitoring";
import { hasScheduledAutomationAccess } from "@/lib/trial";
import { PLAN_LIMITS } from "@/lib/utils";
import type { ScanFrequency, ScanResult, ScanSchedule, UserProfile, Website } from "@/types";

type QueueStatus = "pending" | "processing" | "completed" | "failed" | "skipped";
type MonitoringRowStatus = "pending" | "processing" | "failed" | "skipped";
type ScanFailureReason =
  | "timeout"
  | "api_error"
  | "plan_limit_reached"
  | "queue_backlog"
  | "account_ineligible";

type ScanJobQueueRow = {
  id: string;
  user_id: string;
  website_id: string;
  scan_result_id: string | null;
  frequency: ScanFrequency;
  timezone: string;
  period_key: string;
  dedupe_key: string;
  scheduled_for: string;
  next_attempt_at: string;
  attempt_count: number;
  status: QueueStatus;
  failure_reason: ScanFailureReason | null;
  last_error: string | null;
  last_attempt_at: string | null;
  completed_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type CronLogRow = {
  started_at: string;
  status: string;
  items_processed: number | null;
};

type ScanCandidate = {
  id: string;
  userId: string;
  email: string;
  planLabel: string;
  websiteId: string;
  websiteLabel: string;
  websiteUrl: string;
  overPlanLimit: boolean;
  queueRow: ScanJobQueueRow | null;
  schedule: Pick<ScanSchedule, "website_id" | "frequency" | "last_scan_at" | "next_scan_at"> | null;
  completedToday: boolean;
};

export type AdminScanMonitoringRow = {
  id: string;
  userId: string;
  email: string;
  planLabel: string;
  websiteId: string;
  websiteLabel: string;
  websiteUrl: string;
  status: MonitoringRowStatus;
  reason: string;
  lastScanTime: string | null;
  lastError: string | null;
};

export type AdminScanMonitoringData = {
  filters: {
    user: string;
    status: string;
    date: string;
  };
  summary: {
    requiredToday: number;
    completedToday: number;
    failedPendingToday: number;
  };
  progress: {
    completed: number;
    required: number;
    percent: number;
  };
  cron: {
    lastRunAt: string | null;
    lastRunStatus: string;
    lastRunProcessed: number;
  };
  chart: Array<{
    date: string;
    required: number;
    completed: number;
    failed: number;
  }>;
  rows: AdminScanMonitoringRow[];
  error: string | null;
};

function buildScanQueueDedupeKey(websiteId: string, frequency: ScanFrequency, periodKey: string) {
  return `scan-queue:${websiteId}:${frequency}:${periodKey}`;
}

function startOfTodayIso(reference = new Date()) {
  const value = new Date(reference);
  value.setHours(0, 0, 0, 0);
  return value.toISOString();
}

function toDayKey(value: string | null | undefined) {
  return value ? value.slice(0, 10) : "";
}

function isValidDayKey(value: string | null | undefined) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function matchesDateFilter(value: string | null | undefined, dateFilter: string) {
  if (!dateFilter) {
    return true;
  }

  return toDayKey(value) === dateFilter;
}

function formatReason(reason: ScanFailureReason | null | undefined) {
  if (reason === "timeout") return "Timeout";
  if (reason === "api_error") return "API error (Lighthouse / PageSpeed)";
  if (reason === "plan_limit_reached") return "Plan limit reached";
  if (reason === "account_ineligible") return "Account no longer eligible";
  return "Queue backlog";
}

function buildChart(reference: Date, queueRows: ScanJobQueueRow[]) {
  return Array.from({ length: 7 }).map((_, index) => {
    const day = new Date(reference);
    day.setDate(reference.getDate() - (6 - index));
    const dayKey = toDayKey(day.toISOString());

    return {
      date: dayKey,
      required: queueRows.filter((row) => toDayKey(row.scheduled_for) === dayKey).length,
      completed: queueRows.filter((row) => row.status === "completed" && toDayKey(row.completed_at) === dayKey).length,
      failed: queueRows.filter(
        (row) =>
          toDayKey(row.scheduled_for) === dayKey &&
          (row.status === "failed" || row.status === "skipped")
      ).length
    };
  });
}

function findLatestScanBeforeToday(scans: Array<Pick<ScanResult, "scanned_at" | "scan_status">>, timezone: string, todayKey: string) {
  for (const row of scans) {
    if (row.scan_status === "failed") {
      continue;
    }

    if (getLocalDayKey(row.scanned_at, timezone) < todayKey) {
      return row.scanned_at;
    }
  }

  return null;
}

function toMonitoringRow(candidate: ScanCandidate, latestCron: CronLogRow | null, cronRanToday: boolean) {
  if (candidate.overPlanLimit) {
    return {
      id: candidate.id,
      userId: candidate.userId,
      email: candidate.email,
      planLabel: candidate.planLabel,
      websiteId: candidate.websiteId,
      websiteLabel: candidate.websiteLabel,
      websiteUrl: candidate.websiteUrl,
      status: "failed",
      reason: "Plan limit reached",
      lastScanTime: candidate.schedule?.last_scan_at ?? null,
      lastError: "This website is outside the account's current website limit, so no scan job was scheduled."
    } satisfies AdminScanMonitoringRow;
  }

  const queueRow = candidate.queueRow;
  if (queueRow) {
    return {
      id: queueRow.id,
      userId: candidate.userId,
      email: candidate.email,
      planLabel: candidate.planLabel,
      websiteId: candidate.websiteId,
      websiteLabel: candidate.websiteLabel,
      websiteUrl: candidate.websiteUrl,
      status:
        queueRow.status === "processing"
          ? "processing"
          : queueRow.status === "pending"
            ? "pending"
            : queueRow.status === "skipped"
              ? "skipped"
              : "failed",
      reason:
        queueRow.status === "pending" || queueRow.status === "processing"
          ? "Queue backlog"
          : formatReason(queueRow.failure_reason),
      lastScanTime: candidate.schedule?.last_scan_at ?? queueRow.completed_at ?? queueRow.last_attempt_at ?? null,
      lastError: queueRow.last_error
    } satisfies AdminScanMonitoringRow;
  }

  if (!cronRanToday) {
    return {
      id: candidate.id,
      userId: candidate.userId,
      email: candidate.email,
      planLabel: candidate.planLabel,
      websiteId: candidate.websiteId,
      websiteLabel: candidate.websiteLabel,
      websiteUrl: candidate.websiteUrl,
      status: "failed",
      reason: "Cron not triggered",
      lastScanTime: candidate.schedule?.last_scan_at ?? latestCron?.started_at ?? null,
      lastError: "The scan cron did not create a queue job for this due website today."
    } satisfies AdminScanMonitoringRow;
  }

  return {
    id: candidate.id,
    userId: candidate.userId,
    email: candidate.email,
    planLabel: candidate.planLabel,
    websiteId: candidate.websiteId,
    websiteLabel: candidate.websiteLabel,
    websiteUrl: candidate.websiteUrl,
    status: "pending",
    reason: "Queue backlog",
    lastScanTime: candidate.schedule?.last_scan_at ?? latestCron?.started_at ?? null,
    lastError: "The website was due for a scan, but no queue job exists for the current period."
  } satisfies AdminScanMonitoringRow;
}

export async function getAdminScanMonitoringData(input?: {
  user?: string;
  status?: string;
  date?: string;
}): Promise<AdminScanMonitoringData> {
  const admin = createSupabaseAdminClient();
  const now = new Date();
  const todayIso = startOfTodayIso(now);
  const queueLookbackIso = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000).toISOString();
  const userFilter = input?.user?.trim().toLowerCase() ?? "";
  const statusFilter = input?.status?.trim().toLowerCase() ?? "all";
  const dateFilter = isValidDayKey(input?.date) ? (input?.date as string) : "";

  try {
    const [usersResult, websitesResult, schedulesResult, queueResult, cronLogsResult, scanResultsResult] = await Promise.all([
      admin.from("users").select("id,email,plan,timezone,subscription_status,is_trial,trial_ends_at"),
      admin
        .from("websites")
        .select("id,user_id,url,label,is_active,created_at")
        .eq("is_active", true)
        .order("created_at", { ascending: true }),
      admin.from("scan_schedules").select("website_id,frequency,next_scan_at,last_scan_at"),
      admin
        .from("scan_job_queue")
        .select("*")
        .gte("scheduled_for", queueLookbackIso)
        .order("scheduled_for", { ascending: false })
        .limit(5000),
      admin
        .from("cron_logs")
        .select("started_at,status,items_processed")
        .eq("cron_name", "process-scans")
        .gte("started_at", queueLookbackIso)
        .order("started_at", { ascending: false })
        .limit(20),
      admin
        .from("scan_results")
        .select("website_id,scan_status,scanned_at")
        .gte("scanned_at", queueLookbackIso)
        .order("scanned_at", { ascending: false })
        .limit(5000)
    ]);

    if (usersResult.error) throw new Error(usersResult.error.message);
    if (websitesResult.error) throw new Error(websitesResult.error.message);
    if (schedulesResult.error) throw new Error(schedulesResult.error.message);
    if (queueResult.error) throw new Error(queueResult.error.message);
    if (cronLogsResult.error) throw new Error(cronLogsResult.error.message);
    if (scanResultsResult.error) throw new Error(scanResultsResult.error.message);

    const users = (usersResult.data ?? []) as Array<
      Pick<
        UserProfile,
        "id" | "email" | "plan" | "timezone" | "subscription_status" | "is_trial" | "trial_ends_at"
      >
    >;
    const websites = (websitesResult.data ?? []) as Array<
      Pick<Website, "id" | "user_id" | "url" | "label" | "is_active" | "created_at">
    >;
    const schedules = (schedulesResult.data ?? []) as Array<
      Pick<ScanSchedule, "website_id" | "frequency" | "next_scan_at" | "last_scan_at">
    >;
    const queueRows = (queueResult.data ?? []) as ScanJobQueueRow[];
    const cronRows = (cronLogsResult.data ?? []) as CronLogRow[];
    const scanResults = (scanResultsResult.data ?? []) as Array<Pick<ScanResult, "website_id" | "scan_status" | "scanned_at">>;

    const usersById = new Map(users.map((user) => [user.id, user]));
    const schedulesByWebsite = new Map(schedules.map((schedule) => [schedule.website_id, schedule]));
    const queueByDedupeKey = new Map(queueRows.map((row) => [row.dedupe_key, row]));
    const websitesByUser = websites.reduce<Record<string, typeof websites>>((accumulator, website) => {
      accumulator[website.user_id] = accumulator[website.user_id] ?? [];
      accumulator[website.user_id]?.push(website);
      return accumulator;
    }, {});
    const scansByWebsite = scanResults.reduce<Record<string, typeof scanResults>>((accumulator, row) => {
      accumulator[row.website_id] = accumulator[row.website_id] ?? [];
      accumulator[row.website_id]?.push(row);
      return accumulator;
    }, {});

    const latestCron = cronRows[0] ?? null;
    const cronRanToday = cronRows.some((row) => new Date(row.started_at).getTime() >= new Date(todayIso).getTime());

    const dueCandidates = websites
      .map((website) => {
        const user = usersById.get(website.user_id);
        if (!user) {
          return null;
        }

        if (!hasScheduledAutomationAccess(user)) {
          return null;
        }

        const planLimits = PLAN_LIMITS[user.plan];
        const orderedWebsiteIds = (websitesByUser[website.user_id] ?? [])
          .slice()
          .sort((left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime())
          .map((row) => row.id);
        const overPlanLimit = orderedWebsiteIds.findIndex((row) => row === website.id) >= planLimits.websiteLimit;
        const schedule = schedulesByWebsite.get(website.id) ?? null;
        const timezone = normalizeTimezone(user.timezone);
        const todayKey = getLocalDayKey(now, timezone);
        const frequency =
          schedule?.frequency && planLimits.scanFrequencies.includes(schedule.frequency)
            ? schedule.frequency
            : planLimits.scanFrequencies[0];
        const dueBySchedule = schedule?.next_scan_at ? new Date(schedule.next_scan_at).getTime() <= now.getTime() : true;
        const websiteScans = scansByWebsite[website.id] ?? [];
        const lastScanBeforeToday = findLatestScanBeforeToday(websiteScans, timezone, todayKey);
        const completedToday =
          websiteScans.some((row) => row.scan_status !== "failed" && getLocalDayKey(row.scanned_at, timezone) === todayKey) ||
          Boolean(
            queueRows.find(
              (row) =>
                row.website_id === website.id &&
                row.status === "completed" &&
                getLocalDayKey(row.completed_at ?? row.scheduled_for, timezone) === todayKey
            )
          );
        const dueByPeriod = isDueForPeriod({
          frequency,
          lastEventAt: lastScanBeforeToday,
          timezone,
          reference: now
        });

        if (!dueBySchedule && !dueByPeriod) {
          return null;
        }

        const dedupeKey = buildScanQueueDedupeKey(website.id, frequency, getPeriodKey(frequency, now, timezone));

        return {
          id: dedupeKey,
          userId: user.id,
          email: user.email,
          planLabel: getPlanLabel(user.plan),
          websiteId: website.id,
          websiteLabel: website.label,
          websiteUrl: website.url,
          overPlanLimit,
          queueRow: queueByDedupeKey.get(dedupeKey) ?? null,
          schedule,
          completedToday
        } satisfies ScanCandidate;
      })
      .filter((row): row is ScanCandidate => Boolean(row));

    const completedToday = dueCandidates.filter((candidate) => candidate.completedToday).length;
    const failedRows = dueCandidates
      .filter((candidate) => !candidate.completedToday)
      .map((candidate) => toMonitoringRow(candidate, latestCron, cronRanToday));

    return {
      filters: {
        user: input?.user?.trim() ?? "",
        status: statusFilter,
        date: dateFilter
      },
      summary: {
        requiredToday: dueCandidates.length,
        completedToday,
        failedPendingToday: Math.max(dueCandidates.length - completedToday, 0)
      },
      progress: {
        completed: completedToday,
        required: dueCandidates.length,
        percent: dueCandidates.length ? Math.round((completedToday / dueCandidates.length) * 100) : 0
      },
      cron: {
        lastRunAt: latestCron?.started_at ?? null,
        lastRunStatus: latestCron?.status ?? "never",
        lastRunProcessed: latestCron?.items_processed ?? 0
      },
      chart: buildChart(now, queueRows),
      rows: failedRows.filter((row) => {
        const matchesUser =
          !userFilter ||
          row.email.toLowerCase().includes(userFilter) ||
          row.userId.toLowerCase().includes(userFilter) ||
          row.websiteUrl.toLowerCase().includes(userFilter) ||
          row.websiteLabel.toLowerCase().includes(userFilter);
        const matchesStatus = statusFilter === "all" || row.status === statusFilter;
        const matchesDate = matchesDateFilter(row.lastScanTime, dateFilter);

        return matchesUser && matchesStatus && matchesDate;
      }),
      error: null
    };
  } catch (error) {
    return {
      filters: {
        user: input?.user?.trim() ?? "",
        status: statusFilter,
        date: dateFilter
      },
      summary: {
        requiredToday: 0,
        completedToday: 0,
        failedPendingToday: 0
      },
      progress: {
        completed: 0,
        required: 0,
        percent: 0
      },
      cron: {
        lastRunAt: null,
        lastRunStatus: "never",
        lastRunProcessed: 0
      },
      chart: [],
      rows: [],
      error: error instanceof Error ? error.message : "Unable to load scan monitoring."
    };
  }
}
