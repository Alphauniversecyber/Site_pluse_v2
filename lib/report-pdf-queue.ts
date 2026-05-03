import "server-only";

import type { ScanFrequency, ScanResult, UserProfile, Website } from "@/types";
import { logAdminError } from "@/lib/admin/logging";
import { logFailedTask } from "@/lib/failed-tasks";
import type { CronExecutionGuard } from "@/lib/cron";
import { generateAndStoreReport } from "@/lib/report-service";
import { getPeriodKey, getRetryAt, isDueForPeriod, normalizeTimezone } from "@/lib/schedule-monitoring";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { hasScheduledAutomationAccess } from "@/lib/trial";
import { PLAN_LIMITS } from "@/lib/utils";

type QueueStatus = "pending" | "processing" | "completed" | "failed" | "skipped";
type ReportPdfQueueReason =
  | "missing_successful_scan"
  | "frequency_mismatch"
  | "queue_failure"
  | "account_ineligible"
  | "already_generated";

type ReportPdfQueueRow = {
  id: string;
  user_id: string;
  website_id: string;
  report_id: string | null;
  scan_id: string | null;
  frequency: ScanFrequency;
  timezone: string;
  period_key: string;
  dedupe_key: string;
  scheduled_for: string;
  next_attempt_at: string;
  attempt_count: number;
  status: QueueStatus;
  failure_reason: ReportPdfQueueReason | null;
  last_error: string | null;
  last_attempt_at: string | null;
  completed_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type EnqueueDueReportPdfsResult = {
  queuedCount: number;
  inspectedCount: number;
  nextOffset: number | null;
  hasMoreCandidates: boolean;
};

export type ProcessQueuedReportPdfsResult = {
  generatedReportIds: string[];
  processedCount: number;
  inspectedCount: number;
  hasMore: boolean;
};

function buildReportPdfQueueDedupeKey(websiteId: string, frequency: ScanFrequency, periodKey: string) {
  return `report-pdf:${websiteId}:${frequency}:${periodKey}`;
}

function classifyPdfFailure(message: string): ReportPdfQueueReason {
  const normalized = message.toLowerCase();

  if (
    normalized.includes("no successful scan") ||
    normalized.includes("scan result not found") ||
    normalized.includes("scan not found")
  ) {
    return "missing_successful_scan";
  }

  if (normalized.includes("frequency") || normalized.includes("disabled")) {
    return "frequency_mismatch";
  }

  if (normalized.includes("already generated")) {
    return "already_generated";
  }

  return "queue_failure";
}

async function loadEligibleProfiles(limit = 200, offset = 0) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("users")
    .select("id,email,plan,timezone,subscription_status,is_trial,trial_ends_at")
    .in("plan", ["starter", "agency"])
    .order("created_at", { ascending: true })
    .range(offset, offset + Math.max(limit - 1, 0));

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

async function loadActiveWebsites(userIds: string[]) {
  if (!userIds.length) {
    return [] as Array<
      Pick<
        Website,
        "id" | "user_id" | "url" | "label" | "is_active" | "auto_email_reports" | "report_frequency" | "created_at"
      >
    >;
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("websites")
    .select("id,user_id,url,label,is_active,auto_email_reports,report_frequency,created_at")
    .in("user_id", userIds)
    .eq("is_active", true)
    .eq("auto_email_reports", true)
    .neq("report_frequency", "never")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Array<
    Pick<
      Website,
      "id" | "user_id" | "url" | "label" | "is_active" | "auto_email_reports" | "report_frequency" | "created_at"
    >
  >;
}

async function loadLatestSuccessfulScans(websiteIds: string[]) {
  if (!websiteIds.length) {
    return new Map<string, Pick<ScanResult, "id" | "website_id" | "scan_status" | "scanned_at"> | null>();
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("scan_results")
    .select("id,website_id,scan_status,scanned_at")
    .in("website_id", websiteIds)
    .eq("scan_status", "success")
    .order("scanned_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const latest = new Map<string, Pick<ScanResult, "id" | "website_id" | "scan_status" | "scanned_at"> | null>();
  for (const row of (data ?? []) as Array<Pick<ScanResult, "id" | "website_id" | "scan_status" | "scanned_at">>) {
    if (!latest.has(row.website_id)) {
      latest.set(row.website_id, row);
    }
  }

  return latest;
}

async function loadLatestSentReports(websiteIds: string[]) {
  if (!websiteIds.length) {
    return new Map<string, { sent_at: string | null } | null>();
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("reports")
    .select("website_id,sent_at")
    .in("website_id", websiteIds)
    .not("sent_at", "is", null)
    .order("sent_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const latest = new Map<string, { sent_at: string | null } | null>();
  for (const row of (data ?? []) as Array<{ website_id: string; sent_at: string | null }>) {
    if (!latest.has(row.website_id)) {
      latest.set(row.website_id, row);
    }
  }

  return latest;
}

async function loadExistingQueueRows(dedupeKeys: string[]) {
  if (!dedupeKeys.length) {
    return new Map<string, ReportPdfQueueRow>();
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("report_generation_queue")
    .select("*")
    .in("dedupe_key", dedupeKeys);

  if (error) {
    throw new Error(error.message);
  }

  return new Map(((data ?? []) as ReportPdfQueueRow[]).map((row) => [row.dedupe_key, row]));
}

async function insertQueueRows(rows: Array<Partial<ReportPdfQueueRow>>) {
  if (!rows.length) {
    return [] as ReportPdfQueueRow[];
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("report_generation_queue")
    .insert(rows)
    .select("*");

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ReportPdfQueueRow[];
}

async function updateQueueRow(id: string, payload: Partial<ReportPdfQueueRow>) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("report_generation_queue")
    .update({
      ...payload,
      updated_at: new Date().toISOString()
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

async function claimQueueRow(row: ReportPdfQueueRow, startedAt: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("report_generation_queue")
    .update({
      status: "processing",
      last_attempt_at: startedAt,
      attempt_count: (row.attempt_count ?? 0) + 1,
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

async function loadWebsite(websiteId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("websites")
    .select("id,user_id,url,label,auto_email_reports,report_frequency")
    .eq("id", websiteId)
    .maybeSingle<Pick<Website, "id" | "user_id" | "url" | "label" | "auto_email_reports" | "report_frequency">>();

  if (error) {
    throw new Error(error.message);
  }

  return data ?? null;
}

async function loadUser(userId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("users")
    .select("id,email,plan,timezone,subscription_status,is_trial,trial_ends_at")
    .eq("id", userId)
    .maybeSingle<
      Pick<
        UserProfile,
        "id" | "email" | "plan" | "timezone" | "subscription_status" | "is_trial" | "trial_ends_at"
      >
    >();

  if (error) {
    throw new Error(error.message);
  }

  return data ?? null;
}

async function loadLatestSuccessfulScan(websiteId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("scan_results")
    .select("id,website_id,scan_status,scanned_at")
    .eq("website_id", websiteId)
    .eq("scan_status", "success")
    .order("scanned_at", { ascending: false })
    .limit(1)
    .maybeSingle<Pick<ScanResult, "id" | "website_id" | "scan_status" | "scanned_at">>();

  if (error) {
    throw new Error(error.message);
  }

  return data ?? null;
}

async function loadQueueRowById(queueId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("report_generation_queue")
    .select("*")
    .eq("id", queueId)
    .maybeSingle<ReportPdfQueueRow>();

  if (error) {
    throw new Error(error.message);
  }

  return data ?? null;
}

export async function enqueueDueReportPdfs(limit = 200, offset = 0): Promise<EnqueueDueReportPdfsResult> {
  const profiles = await loadEligibleProfiles(limit, offset);
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const websites = await loadActiveWebsites(profiles.map((profile) => profile.id));
  const latestScans = await loadLatestSuccessfulScans(websites.map((website) => website.id));
  const latestReports = await loadLatestSentReports(websites.map((website) => website.id));
  const now = new Date();

  const candidates = websites
    .map((website) => {
      const profile = profileById.get(website.user_id);

      if (!profile || !PLAN_LIMITS[profile.plan].emailReports || !hasScheduledAutomationAccess(profile)) {
        return null;
      }

      const timezone = normalizeTimezone(profile.timezone);
      const frequencySetting = website.report_frequency ?? "weekly";
      if (frequencySetting === "never") {
        return null;
      }

      const frequency: ScanFrequency = frequencySetting;
      const periodKey = getPeriodKey(frequency, now, timezone);
      const latestSentAt = latestReports.get(website.id)?.sent_at ?? null;

      if (!isDueForPeriod({ frequency, lastEventAt: latestSentAt, timezone, reference: now })) {
        return null;
      }

      const latestScan = latestScans.get(website.id) ?? null;
      const dedupeKey = buildReportPdfQueueDedupeKey(website.id, frequency, periodKey);
      const baseRow = {
        user_id: profile.id,
        website_id: website.id,
        scan_id: latestScan?.id ?? null,
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
          websiteLabel: website.label,
          latestScanId: latestScan?.id ?? null,
          latestScanStatus: latestScan?.scan_status ?? null
        }
      };

      if (!latestScan) {
        return {
          ...baseRow,
          status: "failed" as const,
          failure_reason: "missing_successful_scan" as const,
          last_error: "No successful scan is available to generate the scheduled PDF report."
        };
      }

      return {
        ...baseRow,
        status: "pending" as const,
        failure_reason: null,
        last_error: null
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  const existingRows = await loadExistingQueueRows(candidates.map((row) => row.dedupe_key));
  const rowsToInsert = candidates.filter((row) => !existingRows.has(row.dedupe_key));

  const insertedRows = await insertQueueRows(rowsToInsert);

  for (const row of insertedRows.filter((item) => item.status === "failed")) {
    await logFailedTask({
      cronName: "process-report-pdfs",
      taskType: "generate-report",
      userId: row.user_id,
      siteId: row.website_id,
      errorMessage: row.last_error ?? "Scheduled PDF generation failed before queue processing.",
      payload: {
        queueId: row.id,
        userId: row.user_id,
        websiteId: row.website_id,
        scanId: row.scan_id,
        frequency: row.frequency
      }
    });
  }

  const nextOffset = profiles.length === limit ? offset + profiles.length : null;

  return {
    queuedCount: rowsToInsert.length,
    inspectedCount: profiles.length,
    nextOffset,
    hasMoreCandidates: nextOffset !== null
  };
}

async function processReportPdfQueueRow(row: ReportPdfQueueRow) {
  const startedAt = new Date().toISOString();

  try {
    const website = await loadWebsite(row.website_id);
    const profile = await loadUser(row.user_id);

    if (
      !website ||
      !profile ||
      !PLAN_LIMITS[profile.plan]?.emailReports ||
      !hasScheduledAutomationAccess(profile) ||
      !website.auto_email_reports ||
      website.report_frequency === "never"
    ) {
      const message =
        !profile || !hasScheduledAutomationAccess(profile)
          ? "Scheduled reports are no longer enabled for this account."
          : "Report generation is no longer enabled for this website.";
      await updateQueueRow(row.id, {
        status: "skipped",
        failure_reason: !profile || !hasScheduledAutomationAccess(profile) ? "account_ineligible" : "frequency_mismatch",
        last_error: message,
        last_attempt_at: startedAt
      });

      return {
        status: "skipped" as const,
        message
      };
    }

    if ((website.report_frequency ?? "weekly") !== row.frequency) {
      const message = "The website report frequency changed after this queue item was created.";
      await updateQueueRow(row.id, {
        status: "skipped",
        failure_reason: "frequency_mismatch",
        last_error: message,
        last_attempt_at: startedAt
      });

      return {
        status: "skipped" as const,
        message
      };
    }

    const claimed = await claimQueueRow(row, startedAt);
    if (!claimed) {
      return {
        status: "skipped" as const,
        message: "This queue row was claimed by another worker."
      };
    }

    const latestSuccessfulScan = await loadLatestSuccessfulScan(row.website_id);

    if (!latestSuccessfulScan) {
      throw new Error("No successful scan is available to generate the scheduled PDF report.");
    }

    const report = await generateAndStoreReport({
      websiteId: row.website_id,
      scanId: latestSuccessfulScan.id
    });

    await updateQueueRow(row.id, {
      report_id: report.id,
      scan_id: latestSuccessfulScan.id,
      status: "completed",
      failure_reason: null,
      last_error: null,
      last_attempt_at: startedAt,
      completed_at: report.created_at ?? new Date().toISOString(),
      metadata: {
        ...row.metadata,
        latestScanId: latestSuccessfulScan.id,
        latestScanStatus: latestSuccessfulScan.scan_status
      }
    });

    return {
      status: "completed" as const,
      reportId: report.id
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown report PDF queue failure.";
    const failureReason = classifyPdfFailure(message);
    const attemptCount = (row.attempt_count ?? 0) + 1;

    await updateQueueRow(row.id, {
      status: "failed",
      failure_reason: failureReason,
      last_error: message,
      last_attempt_at: startedAt,
      next_attempt_at: getRetryAt(Math.min(60, attemptCount * 10)),
      attempt_count: attemptCount
    });

    await logAdminError({
      errorType: "pdf_failed",
      errorMessage: message,
      websiteId: row.website_id,
      userId: row.user_id,
      context: {
        queue: "report_generation_queue",
        queueId: row.id,
        failureReason
      },
      dedupeWindowMinutes: 30
    });
    await logFailedTask({
      cronName: "process-report-pdfs",
      taskType: "generate-report",
      userId: row.user_id,
      siteId: row.website_id,
      errorMessage: message,
      payload: {
        queueId: row.id,
        userId: row.user_id,
        websiteId: row.website_id,
        scanId: row.scan_id,
        frequency: row.frequency
      }
    });

    return {
      status: "failed" as const,
      message
    };
  }
}

export async function retryReportPdfQueueTask(input: { queueId: string }) {
  const row = await loadQueueRowById(input.queueId);

  if (!row) {
    throw new Error("Report generation queue row not found.");
  }

  return processReportPdfQueueRow(row);
}

export async function processQueuedReportPdfs(
  limit = 25,
  guard?: CronExecutionGuard
): Promise<ProcessQueuedReportPdfsResult> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("report_generation_queue")
    .select("*")
    .in("status", ["pending", "failed"])
    .lte("next_attempt_at", new Date().toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as ReportPdfQueueRow[];
  const generatedReportIds: string[] = [];
  let inspectedCount = 0;

  for (const row of rows) {
    if (
      guard?.shouldStop({
        queue: "report_generation_queue",
        processedCount: generatedReportIds.length,
        queueId: row.id,
        websiteId: row.website_id
      })
    ) {
      break;
    }

    inspectedCount += 1;
    const result = await processReportPdfQueueRow(row);
    if (result.status === "completed" && result.reportId) {
      generatedReportIds.push(result.reportId);
    }
  }

  return {
    generatedReportIds,
    processedCount: generatedReportIds.length,
    inspectedCount,
    hasMore: inspectedCount < rows.length || rows.length === limit
  };
}
