import "server-only";

import type { ReportFrequency, ScanFrequency, UserProfile, Website } from "@/types";
import { logAdminError, logScanExecution } from "@/lib/admin/logging";
import type { CronExecutionGuard } from "@/lib/cron";
import { executeWebsiteScan } from "@/lib/scan-service";
import { getPeriodKey, getRetryAt, isDueForPeriod, normalizeTimezone } from "@/lib/schedule-monitoring";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { hasScheduledAutomationAccess } from "@/lib/trial";
import { PLAN_LIMITS } from "@/lib/utils";

type QueueStatus = "pending" | "processing" | "completed" | "failed" | "skipped";
type ScanFailureReason =
  | "timeout"
  | "api_error"
  | "plan_limit_reached"
  | "queue_backlog"
  | "account_ineligible"
  | "schedule_disabled"
  | "superseded";

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

type ScanScheduleRow = {
  website_id: string;
  frequency: ScanFrequency;
  next_scan_at: string | null;
  last_scan_at: string | null;
};

export type EnqueueDueScanJobsResult = {
  queuedCount: number;
  inspectedCount: number;
  nextOffset: number | null;
  hasMoreCandidates: boolean;
};

export type ProcessQueuedScanJobsResult = {
  executedWebsiteIds: string[];
  processedCount: number;
  inspectedCount: number;
  settledCount: number;
  hasMore: boolean;
};

export type EnqueueFailedScanRetryJobsResult = {
  queuedCount: number;
  inspectedCount: number;
  candidateCount: number;
};

const SCAN_EXECUTION_TIMEOUT_MS = 45_000;
const FAILED_SCAN_RETRY_LOOKBACK_HOURS = 48;
const FAILED_SCAN_RETRY_RECENT_SCAN_LIMIT = 600;

function buildScanQueueDedupeKey(websiteId: string, frequency: ScanFrequency, periodKey: string) {
  return `scan-queue:${websiteId}:${frequency}:${periodKey}`;
}

function buildFailedScanRetryDedupeKey(websiteId: string, failedScanId: string) {
  return `scan-retry:${websiteId}:${failedScanId}`;
}

function classifyScanFailure(message: string): ScanFailureReason {
  const normalized = message.toLowerCase();

  if (normalized.includes("timeout")) {
    return "timeout";
  }

  if (
    normalized.includes("pagespeed") ||
    normalized.includes("lighthouse") ||
    normalized.includes("google api") ||
    normalized.includes("429") ||
    normalized.includes("api")
  ) {
    return "api_error";
  }

  return "queue_backlog";
}

function getFailedScanRetryLookbackIso() {
  return new Date(Date.now() - FAILED_SCAN_RETRY_LOOKBACK_HOURS * 60 * 60 * 1000).toISOString();
}

async function loadProfiles(userIds: string[]) {
  if (!userIds.length) {
    return [] as Array<
      Pick<
        UserProfile,
        "id" | "email" | "plan" | "timezone" | "subscription_status" | "is_trial" | "trial_ends_at"
      >
    >;
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("users")
    .select("id,email,plan,timezone,subscription_status,is_trial,trial_ends_at")
    .in("id", userIds);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Array<
    Pick<
      UserProfile,
      "id" | "email" | "plan" | "timezone" | "subscription_status" | "is_trial" | "trial_ends_at"
    >
  >;
}

async function loadActiveWebsites(limit?: number | null, offset = 0) {
  const admin = createSupabaseAdminClient();
  let query = admin
    .from("websites")
    .select("id,user_id,url,label,is_active,report_frequency,auto_email_reports,created_at")
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (typeof limit === "number" && Number.isFinite(limit) && limit > 0) {
    query = query.range(offset, offset + Math.max(limit - 1, 0));
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Array<
    Pick<
      Website,
      "id" | "user_id" | "url" | "label" | "is_active" | "report_frequency" | "auto_email_reports" | "created_at"
    >
  >;
}

async function loadActiveWebsitesByIds(websiteIds: string[]) {
  if (!websiteIds.length) {
    return [] as Array<
      Pick<
        Website,
        "id" | "user_id" | "url" | "label" | "is_active" | "report_frequency" | "auto_email_reports" | "created_at"
      >
    >;
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("websites")
    .select("id,user_id,url,label,is_active,report_frequency,auto_email_reports,created_at")
    .eq("is_active", true)
    .in("id", websiteIds);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Array<
    Pick<
      Website,
      "id" | "user_id" | "url" | "label" | "is_active" | "report_frequency" | "auto_email_reports" | "created_at"
    >
  >;
}

async function loadActiveWebsitesForUsers(userIds: string[]) {
  if (!userIds.length) {
    return [] as Array<Pick<Website, "id" | "user_id" | "created_at">>;
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("websites")
    .select("id,user_id,created_at")
    .eq("is_active", true)
    .in("user_id", userIds)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Array<Pick<Website, "id" | "user_id" | "created_at">>;
}

async function loadSchedules(websiteIds: string[]) {
  if (!websiteIds.length) {
    return new Map<string, ScanScheduleRow>();
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("scan_schedules")
    .select("website_id,frequency,next_scan_at,last_scan_at")
    .in("website_id", websiteIds);

  if (error) {
    throw new Error(error.message);
  }

  return new Map(((data ?? []) as ScanScheduleRow[]).map((row) => [row.website_id, row]));
}

async function loadExistingQueueRows(dedupeKeys: string[]) {
  if (!dedupeKeys.length) {
    return new Map<string, ScanJobQueueRow>();
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("scan_job_queue")
    .select("*")
    .in("dedupe_key", dedupeKeys);

  if (error) {
    throw new Error(error.message);
  }

  return new Map(((data ?? []) as ScanJobQueueRow[]).map((row) => [row.dedupe_key, row]));
}

async function loadRecentScansForRetry(limit = FAILED_SCAN_RETRY_RECENT_SCAN_LIMIT) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("scan_results")
    .select("id,website_id,scan_status,error_message,scanned_at")
    .gte("scanned_at", getFailedScanRetryLookbackIso())
    .order("scanned_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Array<{
    id: string;
    website_id: string;
    scan_status: "success" | "failed";
    error_message: string | null;
    scanned_at: string;
  }>;
}

async function insertQueueRows(rows: Array<Partial<ScanJobQueueRow>>) {
  if (!rows.length) {
    return;
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("scan_job_queue").insert(rows);

  if (error) {
    throw new Error(error.message);
  }
}

async function updateQueueRow(id: string, payload: Partial<ScanJobQueueRow>) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("scan_job_queue")
    .update({
      ...payload,
      updated_at: new Date().toISOString()
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

async function claimQueueRow(row: ScanJobQueueRow, startedAt: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("scan_job_queue")
    .update({
      status: "processing",
      attempt_count: (row.attempt_count ?? 0) + 1,
      last_attempt_at: startedAt,
      updated_at: new Date().toISOString()
    })
    .eq("id", row.id)
    .eq("status", row.status)
    .eq("updated_at", row.updated_at)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data?.id);
}

async function countDueQueuedScanJobs() {
  const admin = createSupabaseAdminClient();
  const { count, error } = await admin
    .from("scan_job_queue")
    .select("*", { count: "exact", head: true })
    .in("status", ["pending", "failed"])
    .lte("next_attempt_at", new Date().toISOString());

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

function toScanFrequency(value: ReportFrequency): ScanFrequency | null {
  return value === "never" ? null : value;
}

function isCurrentPeriod(row: Pick<ScanJobQueueRow, "frequency" | "period_key" | "timezone">) {
  return row.period_key === getPeriodKey(row.frequency, new Date(), row.timezone);
}

async function executeWebsiteScanWithTimeout(websiteId: string) {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      executeWebsiteScan(websiteId),
      new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new Error("timeout"));
        }, SCAN_EXECUTION_TIMEOUT_MS);
      })
    ]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

export async function enqueueDueScanJobs(limit?: number | null, offset = 0): Promise<EnqueueDueScanJobsResult> {
  const websites = await loadActiveWebsites(limit, offset);
  const profiles = await loadProfiles(Array.from(new Set(websites.map((website) => website.user_id))));
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const activeWebsitesForUsers = await loadActiveWebsitesForUsers(
    Array.from(new Set(websites.map((website) => website.user_id)))
  );
  const schedules = await loadSchedules(websites.map((website) => website.id));
  const websitesByUser = activeWebsitesForUsers.reduce<Record<string, typeof activeWebsitesForUsers>>(
    (accumulator, website) => {
    accumulator[website.user_id] = accumulator[website.user_id] ?? [];
    accumulator[website.user_id]?.push(website);
    return accumulator;
    },
    {}
  );
  const now = new Date();
  const candidates: Array<Partial<ScanJobQueueRow>> = [];

  for (const website of websites) {
    const profile = profileById.get(website.user_id);

    if (!profile) {
      continue;
    }

    if (!hasScheduledAutomationAccess(profile)) {
      continue;
    }

    const planLimits = PLAN_LIMITS[profile.plan];
    if (!planLimits.emailReports || !website.auto_email_reports) {
      continue;
    }

    const reportFrequency = website.report_frequency ?? "weekly";
    const requestedFrequency = toScanFrequency(reportFrequency);
    if (!requestedFrequency || !planLimits.scanFrequencies.includes(requestedFrequency)) {
      continue;
    }

    const ownedWebsites = websitesByUser[website.user_id] ?? [];
    const orderedWebsites = ownedWebsites
      .slice()
      .sort((left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime());
    const websiteIndex = orderedWebsites.findIndex((item) => item.id === website.id);
    const schedule = schedules.get(website.id);
    const timezone = normalizeTimezone(profile.timezone);
    const frequency = requestedFrequency;

    const dueBySchedule = schedule?.next_scan_at ? new Date(schedule.next_scan_at).getTime() <= now.getTime() : true;
    const dueByPeriod = isDueForPeriod({
      frequency,
      lastEventAt: schedule?.last_scan_at,
      timezone,
      reference: now
    });

    if (!dueBySchedule && !dueByPeriod) {
      continue;
    }

    const periodKey = getPeriodKey(frequency, now, timezone);
    const dedupeKey = buildScanQueueDedupeKey(website.id, frequency, periodKey);
    const baseRow = {
      user_id: profile.id,
      website_id: website.id,
      frequency,
      timezone,
      period_key: periodKey,
      dedupe_key: dedupeKey,
      scheduled_for: now.toISOString(),
      next_attempt_at: now.toISOString(),
      metadata: {
        userEmail: profile.email,
        plan: profile.plan,
        websiteUrl: website.url,
        websiteLabel: website.label
      }
    };

    if (websiteIndex >= planLimits.websiteLimit) {
      candidates.push({
        ...baseRow,
        status: "skipped",
        failure_reason: "plan_limit_reached",
        last_error: "This website is over the current plan's website limit, so the scan was not scheduled."
      });
      continue;
    }

    candidates.push({
      ...baseRow,
      status: "pending",
      failure_reason: null,
      last_error: null
    });
  }

  const existingRows = await loadExistingQueueRows(candidates.map((row) => row.dedupe_key as string));
  const rowsToInsert = candidates.filter((row) => !existingRows.has(row.dedupe_key as string));
  await insertQueueRows(rowsToInsert);
  const hasPagedLimit = typeof limit === "number" && Number.isFinite(limit) && limit > 0;
  const nextOffset = hasPagedLimit && websites.length === limit ? offset + websites.length : null;

  return {
    queuedCount: rowsToInsert.length,
    inspectedCount: websites.length,
    nextOffset,
    hasMoreCandidates: nextOffset !== null
  };
}

export async function enqueueFailedScanRetryJobs(): Promise<EnqueueFailedScanRetryJobsResult> {
  const recentScans = await loadRecentScansForRetry();
  const latestScanByWebsite = new Map<
    string,
    {
      id: string;
      website_id: string;
      scan_status: "success" | "failed";
      error_message: string | null;
      scanned_at: string;
    }
  >();

  for (const scan of recentScans) {
    if (!latestScanByWebsite.has(scan.website_id)) {
      latestScanByWebsite.set(scan.website_id, scan);
    }
  }

  const failedLatestScans = Array.from(latestScanByWebsite.values()).filter(
    (scan) => scan.scan_status === "failed"
  );

  const websites = await loadActiveWebsitesByIds(failedLatestScans.map((scan) => scan.website_id));
  const websiteById = new Map(websites.map((website) => [website.id, website]));
  const profiles = await loadProfiles(Array.from(new Set(websites.map((website) => website.user_id))));
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const activeWebsitesForUsers = await loadActiveWebsitesForUsers(
    Array.from(new Set(websites.map((website) => website.user_id)))
  );
  const schedules = await loadSchedules(websites.map((website) => website.id));
  const websitesByUser = activeWebsitesForUsers.reduce<Record<string, typeof activeWebsitesForUsers>>(
    (accumulator, website) => {
      accumulator[website.user_id] = accumulator[website.user_id] ?? [];
      accumulator[website.user_id]?.push(website);
      return accumulator;
    },
    {}
  );
  const now = new Date();
  const candidates: Array<Partial<ScanJobQueueRow>> = [];

  for (const failedScan of failedLatestScans) {
    const website = websiteById.get(failedScan.website_id);
    if (!website) {
      continue;
    }

    const profile = profileById.get(website.user_id);
    if (!profile || !hasScheduledAutomationAccess(profile)) {
      continue;
    }

    const planLimits = PLAN_LIMITS[profile.plan];
    if (!planLimits.emailReports || !website.auto_email_reports) {
      continue;
    }

    const reportFrequency = website.report_frequency ?? "weekly";
    const requestedFrequency = toScanFrequency(reportFrequency);
    if (!requestedFrequency || !planLimits.scanFrequencies.includes(requestedFrequency)) {
      continue;
    }

    const ownedWebsites = websitesByUser[website.user_id] ?? [];
    const orderedWebsites = ownedWebsites
      .slice()
      .sort((left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime());
    const websiteIndex = orderedWebsites.findIndex((item) => item.id === website.id);
    if (websiteIndex >= planLimits.websiteLimit) {
      continue;
    }

    const timezone = normalizeTimezone(profile.timezone);
    const frequency = requestedFrequency;
    const periodKey = getPeriodKey(frequency, now, timezone);

    candidates.push({
      user_id: profile.id,
      website_id: website.id,
      scan_result_id: failedScan.id,
      frequency,
      timezone,
      period_key: periodKey,
      dedupe_key: buildFailedScanRetryDedupeKey(website.id, failedScan.id),
      scheduled_for: now.toISOString(),
      next_attempt_at: now.toISOString(),
      status: "pending",
      failure_reason: null,
      last_error: null,
      metadata: {
        source: "retry-failed-scans",
        retryReason: "latest_scan_failed",
        failedScanId: failedScan.id,
        failedScanAt: failedScan.scanned_at,
        failedScanError: failedScan.error_message,
        userEmail: profile.email,
        plan: profile.plan,
        websiteUrl: website.url,
        websiteLabel: website.label
      }
    });
  }

  const existingRows = await loadExistingQueueRows(candidates.map((row) => row.dedupe_key as string));
  const rowsToInsert = candidates.filter((row) => !existingRows.has(row.dedupe_key as string));
  await insertQueueRows(rowsToInsert);

  return {
    queuedCount: rowsToInsert.length,
    inspectedCount: recentScans.length,
    candidateCount: candidates.length
  };
}

export async function processQueuedScanJobs(
  limit = 20,
  guard?: CronExecutionGuard
): Promise<ProcessQueuedScanJobsResult> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("scan_job_queue")
    .select("*")
    .in("status", ["pending", "failed"])
    .lte("next_attempt_at", new Date().toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as ScanJobQueueRow[];
  const executedWebsiteIds: string[] = [];
  let inspectedCount = 0;
  let settledCount = 0;

  for (const row of rows) {
    if (
      guard?.shouldStop({
        queue: "scan_job_queue",
        processedCount: executedWebsiteIds.length,
        queueId: row.id,
        websiteId: row.website_id
      })
    ) {
      break;
    }

    inspectedCount += 1;

    if (row.failure_reason === "plan_limit_reached") {
      await updateQueueRow(row.id, {
        status: "skipped",
        last_attempt_at: new Date().toISOString()
      });
      settledCount += 1;
      continue;
    }

    if (!isCurrentPeriod(row)) {
      await updateQueueRow(row.id, {
        status: "skipped",
        failure_reason: "superseded",
        last_error: "This queued scan belongs to an older schedule period and was skipped.",
        last_attempt_at: new Date().toISOString()
      });
      settledCount += 1;
      continue;
    }

    const startedAt = new Date().toISOString();

    try {
      const claimed = await claimQueueRow(row, startedAt);
      if (!claimed) {
        continue;
      }

      const { data: currentProfile } = await admin
        .from("users")
        .select("id,plan,subscription_status,is_trial,trial_ends_at")
        .eq("id", row.user_id)
        .maybeSingle<
          Pick<UserProfile, "id" | "plan" | "subscription_status" | "is_trial" | "trial_ends_at">
        >();

      if (!currentProfile || !hasScheduledAutomationAccess(currentProfile)) {
        await updateQueueRow(row.id, {
          status: "skipped",
          failure_reason: "account_ineligible",
          last_error: "Scheduled scans are no longer enabled for this account.",
          last_attempt_at: startedAt
        });
        settledCount += 1;
        continue;
      }

      const { data: currentWebsite } = await admin
        .from("websites")
        .select("id,auto_email_reports,report_frequency")
        .eq("id", row.website_id)
        .maybeSingle<Pick<Website, "id" | "auto_email_reports" | "report_frequency">>();

      const currentPlanLimits = PLAN_LIMITS[currentProfile.plan];
      const currentReportFrequency = currentWebsite?.report_frequency ?? "weekly";
      if (
        !currentWebsite ||
        !currentPlanLimits.emailReports ||
        !currentWebsite.auto_email_reports ||
        currentReportFrequency === "never" ||
        currentReportFrequency !== row.frequency
      ) {
        await updateQueueRow(row.id, {
          status: "skipped",
          failure_reason: "schedule_disabled",
          last_error: "Scheduled scans are disabled because this website is not enabled for scheduled report emails.",
          last_attempt_at: startedAt
        });
        settledCount += 1;
        continue;
      }

      const result = await executeWebsiteScanWithTimeout(row.website_id);

      await updateQueueRow(row.id, {
        scan_result_id: result.scan.id,
        status: "completed",
        failure_reason: null,
        last_error: null,
        last_attempt_at: startedAt,
        completed_at: result.scan.scanned_at
      });
      await logScanExecution({
        scanJobId: row.id,
        websiteId: row.website_id,
        userId: row.user_id,
        status: "completed",
        startedAt,
        finishedAt: result.scan.scanned_at,
        metadata: {
          scanId: result.scan.id
        }
      });
      executedWebsiteIds.push(row.website_id);
      settledCount += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown scan queue failure.";
      const failureReason = classifyScanFailure(message);
      const attemptCount = (row.attempt_count ?? 0) + 1;

      await updateQueueRow(row.id, {
        status: "failed",
        failure_reason: failureReason,
        last_error: message,
        last_attempt_at: startedAt,
        next_attempt_at: getRetryAt(Math.min(60, attemptCount * 10)),
        attempt_count: attemptCount
      });
      settledCount += 1;
      await logScanExecution({
        scanJobId: row.id,
        websiteId: row.website_id,
        userId: row.user_id,
        status: "failed",
        failureReason,
        errorMessage: message,
        startedAt,
        finishedAt: new Date().toISOString()
      });
      await logAdminError({
        errorType: "scan_failed",
        errorMessage: message,
        websiteId: row.website_id,
        userId: row.user_id,
        context: {
          queue: "scan_job_queue",
          queueId: row.id,
          failureReason
        },
        dedupeWindowMinutes: 30
      });
    }
  }

  const dueQueuedCount = await countDueQueuedScanJobs();

  return {
    executedWebsiteIds,
    processedCount: executedWebsiteIds.length,
    inspectedCount,
    settledCount,
    hasMore: inspectedCount < rows.length || dueQueuedCount > 0
  };
}
