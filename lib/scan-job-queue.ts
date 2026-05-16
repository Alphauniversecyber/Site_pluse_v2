import "server-only";

import type { ScanFrequency, UserProfile, Website } from "@/types";
import { logAdminError, logScanExecution } from "@/lib/admin/logging";
import {
  logFailedTask,
  markFailedTaskResolved,
  markFailedTaskRetried,
  markFailedTaskRetryFailed,
  type FailedTaskRecord
} from "@/lib/failed-tasks";
import type { CronExecutionGuard } from "@/lib/cron";
import { executeWebsiteScan } from "@/lib/scan-service";
import { isPageSpeedRateLimitError } from "@/lib/scan-errors";
import { getPeriodKey, getRetryAt, isDueForPeriod, normalizeTimezone } from "@/lib/schedule-monitoring";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { hasScheduledAutomationAccess } from "@/lib/trial";
import { PLAN_LIMITS } from "@/lib/utils";

type QueueStatus = "pending" | "processing" | "completed" | "failed" | "skipped";
type ScanFailureReason =
  | "timeout"
  | "api_error"
  | "rate_limited"
  | "network_error"
  | "parse_error"
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
const SCAN_DELAY_BETWEEN_RUNS_MS = 2_500;
const SCAN_CRON_ELAPSED_STOP_MS = 50_000;
const FAILED_SCAN_RETRY_LOOKBACK_HOURS = 48;
const FAILED_SCAN_RETRY_TASK_LIMIT = 250;
const PAGE_SPEED_RATE_LIMIT_COOLDOWN_MS = 15 * 60 * 1000;

function buildScanQueueDedupeKey(websiteId: string, frequency: ScanFrequency, periodKey: string) {
  return `scan-queue:${websiteId}:${frequency}:${periodKey}`;
}

function buildFailedScanRetryDedupeKey(taskId: string, retryCount: number) {
  return `scan-retry:${taskId}:${retryCount + 1}`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeParseErrorMessage(message: string) {
  const shortMessage = message.replace(/\s+/g, " ").trim().slice(0, 120) || "unknown response";
  return `parse-error: ${shortMessage}`;
}

function classifyScanFailure(message: string): {
  failureReason: ScanFailureReason;
  failedTaskMessage: string;
} {
  const normalized = message.toLowerCase();

  if (normalized.includes("timeout") || normalized.includes("timed out")) {
    return {
      failureReason: "timeout",
      failedTaskMessage: "timeout"
    };
  }

  if (
    isPageSpeedRateLimitError(message) ||
    normalized.includes("rate-limited: pagespeed") ||
    normalized.includes("quota")
  ) {
    return {
      failureReason: "rate_limited",
      failedTaskMessage: "rate-limited: PageSpeed"
    };
  }

  if (
    normalized.includes("network-error") ||
    normalized.includes("network request failed") ||
    normalized.includes("fetch failed") ||
    normalized.includes("econnreset") ||
    normalized.includes("econnrefused") ||
    normalized.includes("enotfound")
  ) {
    return {
      failureReason: "network_error",
      failedTaskMessage: "network-error"
    };
  }

  if (
    normalized.includes("parse-error") ||
    normalized.includes("parse failed") ||
    normalized.includes("unexpected token") ||
    normalized.includes("json") ||
    normalized.includes("missing lighthouseresult")
  ) {
    return {
      failureReason: "parse_error",
      failedTaskMessage: normalized.startsWith("parse-error:") ? message : normalizeParseErrorMessage(message)
    };
  }

  if (
    normalized.includes("pagespeed") ||
    normalized.includes("lighthouse") ||
    normalized.includes("google api") ||
    normalized.includes("api")
  ) {
    return {
      failureReason: "api_error",
      failedTaskMessage: normalizeParseErrorMessage(message)
    };
  }

  return {
    failureReason: "queue_backlog",
    failedTaskMessage: normalizeParseErrorMessage(message)
  };
}

function getFailedScanRetryLookbackIso() {
  return new Date(Date.now() - FAILED_SCAN_RETRY_LOOKBACK_HOURS * 60 * 60 * 1000).toISOString();
}

function getFailedTaskRetryBaseTimestamp(task: Pick<FailedTaskRecord, "created_at" | "retried_at">) {
  return task.retried_at ?? task.created_at;
}

function getRetryFailedTaskId(metadata: Record<string, unknown>) {
  return typeof metadata.failedTaskId === "string" && metadata.failedTaskId.trim()
    ? metadata.failedTaskId
    : null;
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

async function loadFailedTasksForRetry(limit = FAILED_SCAN_RETRY_TASK_LIMIT) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("failed_tasks")
    .select("*")
    .eq("task_type", "execute-scan")
    .eq("status", "failed")
    .gte("created_at", getFailedScanRetryLookbackIso())
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as FailedTaskRecord[];
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

function isCurrentPeriod(row: Pick<ScanJobQueueRow, "frequency" | "period_key" | "timezone">) {
  return row.period_key === getPeriodKey(row.frequency, new Date(), row.timezone);
}

async function executeWebsiteScanWithTimeout(websiteId: string, rotationIndex?: number) {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      executeWebsiteScan(websiteId, {
        rotationIndex,
        source: "scheduled"
      }),
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

export async function retryWebsiteScanTask(input: { websiteId: string }) {
  const result = await executeWebsiteScanWithTimeout(input.websiteId);

  if (result.scan.scan_status === "failed") {
    throw new Error(result.scan.error_message ?? "The website scan failed again.");
  }

  return result;
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
    const schedule = schedules.get(website.id);
    const frequency =
      schedule?.frequency && planLimits.scanFrequencies.includes(schedule.frequency)
        ? schedule.frequency
        : planLimits.scanFrequencies[0];
    if (!planLimits.scanFrequencies.includes(frequency)) {
      continue;
    }

    const ownedWebsites = websitesByUser[website.user_id] ?? [];
    const orderedWebsites = ownedWebsites
      .slice()
      .sort((left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime());
    const websiteIndex = orderedWebsites.findIndex((item) => item.id === website.id);
    const timezone = normalizeTimezone(profile.timezone);

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
  const failedTasks = await loadFailedTasksForRetry();
  const tasksWithSites = failedTasks.filter((task) => Boolean(task.site_id));
  const websites = await loadActiveWebsitesByIds(
    tasksWithSites.map((task) => task.site_id).filter((value): value is string => Boolean(value))
  );
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

  for (const failedTask of tasksWithSites) {
    if (!failedTask.site_id) {
      continue;
    }

    const failedAt = new Date(getFailedTaskRetryBaseTimestamp(failedTask)).getTime();
    if (
      /^rate-limited:\s*pagespeed$/i.test(failedTask.error_message) &&
      Date.now() - failedAt < PAGE_SPEED_RATE_LIMIT_COOLDOWN_MS
    ) {
      continue;
    }

    const website = websiteById.get(failedTask.site_id);
    if (!website) {
      continue;
    }

    const profile = profileById.get(website.user_id);
    if (!profile || !hasScheduledAutomationAccess(profile)) {
      continue;
    }

    const planLimits = PLAN_LIMITS[profile.plan];
    const schedule = schedules.get(website.id);
    const frequency =
      schedule?.frequency && planLimits.scanFrequencies.includes(schedule.frequency)
        ? schedule.frequency
        : planLimits.scanFrequencies[0];
    if (!planLimits.scanFrequencies.includes(frequency)) {
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
    const periodKey = getPeriodKey(frequency, now, timezone);

    candidates.push({
      user_id: profile.id,
      website_id: website.id,
      scan_result_id: null,
      frequency,
      timezone,
      period_key: periodKey,
      dedupe_key: buildFailedScanRetryDedupeKey(failedTask.id, failedTask.retry_count ?? 0),
      scheduled_for: now.toISOString(),
      next_attempt_at: now.toISOString(),
      status: "pending",
      failure_reason: null,
      last_error: null,
      metadata: {
        source: "retry-failed-scans",
        retryReason: "failed_task",
        failedTaskId: failedTask.id,
        failedTaskCreatedAt: failedTask.created_at,
        failedTaskError: failedTask.error_message,
        retryCount: failedTask.retry_count ?? 0,
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
  const queuedTaskIdsToMark = new Set(
    rowsToInsert
      .map((row) => getRetryFailedTaskId((row.metadata ?? {}) as Record<string, unknown>))
      .filter((value): value is string => Boolean(value))
  );

  for (const taskId of queuedTaskIdsToMark) {
    await markFailedTaskRetried(taskId);
  }

  return {
    queuedCount: rowsToInsert.length,
    inspectedCount: failedTasks.length,
    candidateCount: candidates.length
  };
}

export async function processQueuedScanJobs(
  limit = 20,
  guard?: CronExecutionGuard
): Promise<ProcessQueuedScanJobsResult> {
  const admin = createSupabaseAdminClient();
  const startedAtMs = Date.now();
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
    if (Date.now() - startedAtMs >= SCAN_CRON_ELAPSED_STOP_MS) {
      break;
    }

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
    const retryFailedTaskId = getRetryFailedTaskId(row.metadata ?? {});

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
        .select("id,is_active")
        .eq("id", row.website_id)
        .maybeSingle<Pick<Website, "id" | "is_active">>();
      const { data: currentSchedule } = await admin
        .from("scan_schedules")
        .select("website_id,frequency")
        .eq("website_id", row.website_id)
        .maybeSingle<Pick<ScanScheduleRow, "website_id" | "frequency">>();

      const currentPlanLimits = PLAN_LIMITS[currentProfile.plan];
      if (
        !currentWebsite ||
        !currentWebsite.is_active ||
        !currentPlanLimits.scanFrequencies.includes(row.frequency) ||
        !currentSchedule ||
        currentSchedule.frequency !== row.frequency
      ) {
        await updateQueueRow(row.id, {
          status: "skipped",
          failure_reason: "schedule_disabled",
          last_error: "Scheduled scans are disabled or this queued job no longer matches the current scan schedule.",
          last_attempt_at: startedAt
        });
        settledCount += 1;
        continue;
      }

      const result = await executeWebsiteScanWithTimeout(row.website_id, inspectedCount - 1);

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
      if (result.scan.scan_status === "failed") {
        const classifiedFailure = classifyScanFailure(
          result.scan.error_message ?? "The scheduled scan completed with a failed result."
        );

        if (retryFailedTaskId) {
          await markFailedTaskRetryFailed(retryFailedTaskId, classifiedFailure.failedTaskMessage);
        } else {
          await logFailedTask({
            cronName: row.metadata?.source === "retry-failed-scans" ? "retry-failed-scans" : "process-scans",
            taskType: "execute-scan",
            userId: row.user_id,
            siteId: row.website_id,
            errorMessage: classifiedFailure.failedTaskMessage,
            payload: {
              scanJobQueueId: row.id,
              userId: row.user_id,
              websiteId: row.website_id,
              scanId: result.scan.id
            }
          });
        }
      } else if (retryFailedTaskId) {
        await markFailedTaskResolved(retryFailedTaskId);
      }
      executedWebsiteIds.push(row.website_id);
      settledCount += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown scan queue failure.";
      const classifiedFailure = classifyScanFailure(message);
      const attemptCount = (row.attempt_count ?? 0) + 1;

      await updateQueueRow(row.id, {
        status: "failed",
        failure_reason: classifiedFailure.failureReason,
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
        failureReason: classifiedFailure.failureReason,
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
          failureReason: classifiedFailure.failureReason
        },
        dedupeWindowMinutes: 30
      });
      if (retryFailedTaskId) {
        await markFailedTaskRetryFailed(retryFailedTaskId, classifiedFailure.failedTaskMessage);
      } else {
        await logFailedTask({
          cronName: row.metadata?.source === "retry-failed-scans" ? "retry-failed-scans" : "process-scans",
          taskType: "execute-scan",
          userId: row.user_id,
          siteId: row.website_id,
          errorMessage: classifiedFailure.failedTaskMessage,
          payload: {
            scanJobQueueId: row.id,
            userId: row.user_id,
            websiteId: row.website_id
          }
        });
      }
    }

    if (settledCount < rows.length && Date.now() - startedAtMs < SCAN_CRON_ELAPSED_STOP_MS) {
      await sleep(SCAN_DELAY_BETWEEN_RUNS_MS);
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
