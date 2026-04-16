import "server-only";

import type { ScanFrequency, UserProfile, Website } from "@/types";
import { logAdminError, logScanExecution } from "@/lib/admin/logging";
import type { CronExecutionGuard } from "@/lib/cron";
import { executeWebsiteScan } from "@/lib/scan-service";
import { getPeriodKey, getRetryAt, isDueForPeriod, normalizeTimezone } from "@/lib/schedule-monitoring";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { PLAN_LIMITS } from "@/lib/utils";

type QueueStatus = "pending" | "processing" | "completed" | "failed" | "skipped";
type ScanFailureReason = "timeout" | "api_error" | "plan_limit_reached" | "queue_backlog";

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

function buildScanQueueDedupeKey(websiteId: string, frequency: ScanFrequency, periodKey: string) {
  return `scan-queue:${websiteId}:${frequency}:${periodKey}`;
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

async function loadProfiles() {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("users")
    .select("id,email,plan,timezone")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Array<Pick<UserProfile, "id" | "email" | "plan" | "timezone">>;
}

async function loadActiveWebsites() {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("websites")
    .select("id,user_id,url,label,is_active,created_at")
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Array<Pick<Website, "id" | "user_id" | "url" | "label" | "is_active" | "created_at">>;
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

export async function enqueueDueScanJobs(limit = 250) {
  const profiles = await loadProfiles();
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const websites = (await loadActiveWebsites()).slice(0, limit);
  const schedules = await loadSchedules(websites.map((website) => website.id));
  const websitesByUser = websites.reduce<Record<string, typeof websites>>((accumulator, website) => {
    accumulator[website.user_id] = accumulator[website.user_id] ?? [];
    accumulator[website.user_id]?.push(website);
    return accumulator;
  }, {});
  const now = new Date();
  const candidates: Array<Partial<ScanJobQueueRow>> = [];

  for (const website of websites) {
    const profile = profileById.get(website.user_id);

    if (!profile) {
      continue;
    }

    const planLimits = PLAN_LIMITS[profile.plan];
    const ownedWebsites = websitesByUser[website.user_id] ?? [];
    const orderedWebsites = ownedWebsites
      .slice()
      .sort((left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime());
    const websiteIndex = orderedWebsites.findIndex((item) => item.id === website.id);
    const schedule = schedules.get(website.id);
    const timezone = normalizeTimezone(profile.timezone);
    const frequency =
      schedule?.frequency && planLimits.scanFrequencies.includes(schedule.frequency)
        ? schedule.frequency
        : planLimits.scanFrequencies[0];

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
        status: "failed",
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
  return rowsToInsert.length;
}

export async function processQueuedScanJobs(limit = 20, guard?: CronExecutionGuard) {
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

    if (row.failure_reason === "plan_limit_reached") {
      continue;
    }

    const startedAt = new Date().toISOString();

    try {
      await updateQueueRow(row.id, {
        status: "processing",
        attempt_count: (row.attempt_count ?? 0) + 1,
        last_attempt_at: startedAt
      });

      const result = await executeWebsiteScan(row.website_id);

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

  return executedWebsiteIds;
}
