import "server-only";

import { getPlanLabel } from "@/lib/admin/format";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getPeriodKey, isDueForPeriod, normalizeTimezone } from "@/lib/schedule-monitoring";
import { PLAN_LIMITS } from "@/lib/utils";
import type { ScanFrequency, ScanResult, UserProfile, Website } from "@/types";

type QueueStatus = "pending" | "processing" | "sent" | "failed" | "skipped";
type MonitoringRowStatus = "pending" | "processing" | "failed" | "skipped";

type ReportEmailQueueRow = {
  id: string;
  user_id: string;
  website_id: string;
  frequency: ScanFrequency;
  timezone: string;
  period_key: string;
  dedupe_key: string;
  scheduled_for: string;
  next_attempt_at: string;
  attempt_count: number;
  status: QueueStatus;
  failure_reason: string | null;
  last_error: string | null;
  last_attempt_at: string | null;
  sent_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type CronLogRow = {
  started_at: string;
  status: string;
  items_processed: number | null;
};

type EmailCandidate = {
  id: string;
  userId: string;
  email: string;
  planLabel: string;
  websiteId: string;
  websiteLabel: string;
  websiteUrl: string;
  queueRow: ReportEmailQueueRow | null;
  latestScan: Pick<ScanResult, "id" | "scan_status" | "scanned_at"> | null;
};

export type AdminEmailMonitoringRow = {
  id: string;
  userId: string;
  email: string;
  planLabel: string;
  websiteId: string;
  websiteLabel: string;
  websiteUrl: string;
  status: MonitoringRowStatus;
  reason: string;
  lastAttempt: string | null;
  lastError: string | null;
};

export type AdminEmailMonitoringData = {
  filters: {
    user: string;
    status: string;
    date: string;
  };
  summary: {
    scheduledToday: number;
    sentToday: number;
    notSentToday: number;
    failedPendingToday: number;
  };
  cron: {
    lastRunAt: string | null;
    lastRunStatus: string;
    lastRunProcessed: number;
  };
  chart: Array<{
    date: string;
    scheduled: number;
    sent: number;
    failed: number;
  }>;
  rows: AdminEmailMonitoringRow[];
  error: string | null;
};

function buildReportQueueDedupeKey(websiteId: string, frequency: ScanFrequency, periodKey: string) {
  return `report-queue:${websiteId}:${frequency}:${periodKey}`;
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

function formatReason(reason: string | null | undefined) {
  if (reason === "smtp_failure") return "SMTP failure";
  if (reason === "cron_not_triggered") return "Cron not triggered";
  if (reason === "frequency_mismatch") return "Frequency mismatch";
  if (reason === "already_sent") return "Already sent (duplicate prevention)";
  if (reason === "missing_pdf_generation") return "Missing PDF generation";
  if (reason === "queue_failure") return "Queue failure";
  return "Queue backlog";
}

function buildChart(reference: Date, queueRows: ReportEmailQueueRow[]) {
  return Array.from({ length: 7 }).map((_, index) => {
    const day = new Date(reference);
    day.setDate(reference.getDate() - (6 - index));
    const dayKey = toDayKey(day.toISOString());

    return {
      date: dayKey,
      scheduled: queueRows.filter((row) => toDayKey(row.scheduled_for) === dayKey).length,
      sent: queueRows.filter((row) => row.status === "sent" && toDayKey(row.sent_at) === dayKey).length,
      failed: queueRows.filter(
        (row) =>
          toDayKey(row.scheduled_for) === dayKey &&
          (row.status === "failed" || row.status === "skipped")
      ).length
    };
  });
}

function toMonitoringRow(candidate: EmailCandidate, latestCron: CronLogRow | null, cronRanToday: boolean) {
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
          ? "Queue failure"
          : formatReason(queueRow.failure_reason),
      lastAttempt: queueRow.last_attempt_at ?? queueRow.updated_at ?? queueRow.created_at,
      lastError: queueRow.last_error
    } satisfies AdminEmailMonitoringRow;
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
      lastAttempt: latestCron?.started_at ?? null,
      lastError: "The report cron never created a queue job for this due report today."
    } satisfies AdminEmailMonitoringRow;
  }

  if (!candidate.latestScan || candidate.latestScan.scan_status === "failed") {
    return {
      id: candidate.id,
      userId: candidate.userId,
      email: candidate.email,
      planLabel: candidate.planLabel,
      websiteId: candidate.websiteId,
      websiteLabel: candidate.websiteLabel,
      websiteUrl: candidate.websiteUrl,
      status: "failed",
      reason: "Missing PDF generation",
      lastAttempt: candidate.latestScan?.scanned_at ?? null,
      lastError: "A successful scan was not available, so SitePulse could not build the PDF report."
    } satisfies AdminEmailMonitoringRow;
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
    reason: "Queue failure",
    lastAttempt: latestCron?.started_at ?? null,
    lastError: "The report was due, but no queue job exists for the current period."
  } satisfies AdminEmailMonitoringRow;
}

export async function getAdminEmailMonitoringData(input?: {
  user?: string;
  status?: string;
  date?: string;
}): Promise<AdminEmailMonitoringData> {
  const admin = createSupabaseAdminClient();
  const now = new Date();
  const todayIso = startOfTodayIso(now);
  const lookbackIso = new Date(now.getTime() - 400 * 24 * 60 * 60 * 1000).toISOString();
  const queueLookbackIso = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000).toISOString();
  const userFilter = input?.user?.trim().toLowerCase() ?? "";
  const statusFilter = input?.status?.trim().toLowerCase() ?? "all";
  const dateFilter = isValidDayKey(input?.date) ? (input?.date as string) : "";

  try {
    const [usersResult, websitesResult, scansResult, reportsResult, queueResult, cronLogsResult] = await Promise.all([
      admin
        .from("users")
        .select("id,email,plan,email_report_frequency,email_reports_enabled,timezone")
        .eq("email_reports_enabled", true)
        .in("plan", ["starter", "agency"]),
      admin
        .from("websites")
        .select("id,user_id,url,label,is_active,email_reports_enabled,email_report_frequency,created_at")
        .eq("is_active", true)
        .eq("email_reports_enabled", true),
      admin
        .from("scan_results")
        .select("id,website_id,scan_status,scanned_at")
        .gte("scanned_at", lookbackIso)
        .order("scanned_at", { ascending: false }),
      admin
        .from("reports")
        .select("website_id,sent_at")
        .not("sent_at", "is", null)
        .gte("sent_at", lookbackIso)
        .order("sent_at", { ascending: false }),
      admin
        .from("report_email_queue")
        .select("*")
        .gte("scheduled_for", queueLookbackIso)
        .order("scheduled_for", { ascending: false })
        .limit(5000),
      admin
        .from("cron_logs")
        .select("started_at,status,items_processed")
        .eq("cron_name", "process-reports")
        .gte("started_at", queueLookbackIso)
        .order("started_at", { ascending: false })
        .limit(20)
    ]);

    if (usersResult.error) throw new Error(usersResult.error.message);
    if (websitesResult.error) throw new Error(websitesResult.error.message);
    if (scansResult.error) throw new Error(scansResult.error.message);
    if (reportsResult.error) throw new Error(reportsResult.error.message);
    if (queueResult.error) throw new Error(queueResult.error.message);
    if (cronLogsResult.error) throw new Error(cronLogsResult.error.message);

    const users = (usersResult.data ?? []) as Array<
      Pick<UserProfile, "id" | "email" | "plan" | "email_report_frequency" | "email_reports_enabled" | "timezone">
    >;
    const websites = (websitesResult.data ?? []) as Array<
      Pick<
        Website,
        "id" | "user_id" | "url" | "label" | "is_active" | "email_reports_enabled" | "email_report_frequency" | "created_at"
      >
    >;
    const scans = (scansResult.data ?? []) as Array<Pick<ScanResult, "id" | "website_id" | "scan_status" | "scanned_at">>;
    const reports = (reportsResult.data ?? []) as Array<{ website_id: string; sent_at: string | null }>;
    const queueRows = (queueResult.data ?? []) as ReportEmailQueueRow[];
    const cronRows = (cronLogsResult.data ?? []) as CronLogRow[];

    const usersById = new Map(users.map((user) => [user.id, user]));
    const latestScanByWebsite = new Map<string, Pick<ScanResult, "id" | "scan_status" | "scanned_at">>();
    for (const row of scans) {
      if (!latestScanByWebsite.has(row.website_id)) {
        latestScanByWebsite.set(row.website_id, row);
      }
    }

    const latestSentReportByWebsite = new Map<string, { sent_at: string | null }>();
    for (const row of reports) {
      if (!latestSentReportByWebsite.has(row.website_id)) {
        latestSentReportByWebsite.set(row.website_id, row);
      }
    }

    const queueByDedupeKey = new Map(queueRows.map((row) => [row.dedupe_key, row]));
    const latestCron = cronRows[0] ?? null;
    const cronRanToday = cronRows.some((row) => new Date(row.started_at).getTime() >= new Date(todayIso).getTime());

    const dueCandidates = websites
      .map((website) => {
        const user = usersById.get(website.user_id);
        if (!user || !PLAN_LIMITS[user.plan]?.emailReports) {
          return null;
        }

        const timezone = normalizeTimezone(user.timezone);
        const frequency = website.email_report_frequency ?? user.email_report_frequency;
        const latestSentAt = latestSentReportByWebsite.get(website.id)?.sent_at ?? null;

        if (!isDueForPeriod({ frequency, lastEventAt: latestSentAt, timezone, reference: now })) {
          return null;
        }

        const dedupeKey = buildReportQueueDedupeKey(website.id, frequency, getPeriodKey(frequency, now, timezone));

        return {
          id: dedupeKey,
          userId: user.id,
          email: user.email,
          planLabel: getPlanLabel(user.plan),
          websiteId: website.id,
          websiteLabel: website.label,
          websiteUrl: website.url,
          queueRow: queueByDedupeKey.get(dedupeKey) ?? null,
          latestScan: latestScanByWebsite.get(website.id) ?? null
        } satisfies EmailCandidate;
      })
      .filter((row): row is EmailCandidate => Boolean(row));

    const sentToday = dueCandidates.filter((candidate) => candidate.queueRow?.status === "sent").length;
    const unsentRows = dueCandidates
      .filter((candidate) => candidate.queueRow?.status !== "sent")
      .map((candidate) => toMonitoringRow(candidate, latestCron, cronRanToday));

    return {
      filters: {
        user: input?.user?.trim() ?? "",
        status: statusFilter,
        date: dateFilter
      },
      summary: {
        scheduledToday: dueCandidates.length,
        sentToday,
        notSentToday: Math.max(dueCandidates.length - sentToday, 0),
        failedPendingToday: unsentRows.length
      },
      cron: {
        lastRunAt: latestCron?.started_at ?? null,
        lastRunStatus: latestCron?.status ?? "never",
        lastRunProcessed: latestCron?.items_processed ?? 0
      },
      chart: buildChart(now, queueRows),
      rows: unsentRows.filter((row) => {
        const matchesUser =
          !userFilter ||
          row.email.toLowerCase().includes(userFilter) ||
          row.userId.toLowerCase().includes(userFilter) ||
          row.websiteUrl.toLowerCase().includes(userFilter) ||
          row.websiteLabel.toLowerCase().includes(userFilter);
        const matchesStatus = statusFilter === "all" || row.status === statusFilter;
        const matchesDate = matchesDateFilter(row.lastAttempt, dateFilter);

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
        scheduledToday: 0,
        sentToday: 0,
        notSentToday: 0,
        failedPendingToday: 0
      },
      cron: {
        lastRunAt: null,
        lastRunStatus: "never",
        lastRunProcessed: 0
      },
      chart: [],
      rows: [],
      error: error instanceof Error ? error.message : "Unable to load email monitoring."
    };
  }
}
