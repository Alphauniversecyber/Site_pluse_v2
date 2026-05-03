import "server-only";

import type { Report, ScanFrequency, UserProfile, Website } from "@/types";
import { logAdminError } from "@/lib/admin/logging";
import { logFailedTask } from "@/lib/failed-tasks";
import type { CronExecutionGuard } from "@/lib/cron";
import { sendStoredReportEmail } from "@/lib/report-service";
import { getPeriodKey, getRetryAt, isDueForPeriod, normalizeTimezone } from "@/lib/schedule-monitoring";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { hasScheduledAutomationAccess } from "@/lib/trial";
import { PLAN_LIMITS } from "@/lib/utils";

type QueueStatus = "pending" | "processing" | "sent" | "failed" | "skipped";
type ReportQueueReason =
  | "smtp_failure"
  | "cron_not_triggered"
  | "frequency_mismatch"
  | "already_sent"
  | "queue_failure"
  | "missing_pdf_generation"
  | "account_ineligible";

type ReportGenerationQueueRow = {
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
  status: "pending" | "processing" | "completed" | "failed" | "skipped";
  failure_reason: string | null;
  last_error: string | null;
  last_attempt_at: string | null;
  completed_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type ReportEmailQueueRow = {
  id: string;
  user_id: string;
  website_id: string;
  report_id: string | null;
  frequency: ScanFrequency;
  timezone: string;
  period_key: string;
  dedupe_key: string;
  scheduled_for: string;
  next_attempt_at: string;
  attempt_count: number;
  status: QueueStatus;
  failure_reason: ReportQueueReason | null;
  last_error: string | null;
  last_attempt_at: string | null;
  sent_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type EnqueueDueReportEmailsResult = {
  queuedCount: number;
  inspectedCount: number;
  nextOffset: number | null;
  hasMoreCandidates: boolean;
};

export type ProcessQueuedReportEmailsResult = {
  sentReportIds: string[];
  processedCount: number;
  inspectedCount: number;
  hasMore: boolean;
};

function buildReportEmailQueueDedupeKey(websiteId: string, frequency: ScanFrequency, periodKey: string) {
  return `report-email:${websiteId}:${frequency}:${periodKey}`;
}

function buildReportPdfQueueDedupeKey(websiteId: string, frequency: ScanFrequency, periodKey: string) {
  return `report-pdf:${websiteId}:${frequency}:${periodKey}`;
}

function classifyEmailFailure(message: string): ReportQueueReason {
  const normalized = message.toLowerCase();

  if (
    normalized.includes("from_email") ||
    normalized.includes("verified sender") ||
    normalized.includes("provider") ||
    normalized.includes("resend") ||
    normalized.includes("unable to send email")
  ) {
    return "smtp_failure";
  }

  if (normalized.includes("pdf") || normalized.includes("report not found") || normalized.includes("download report")) {
    return "missing_pdf_generation";
  }

  if (normalized.includes("frequency") || normalized.includes("disabled")) {
    return "frequency_mismatch";
  }

  return "queue_failure";
}

async function loadEligibleProfiles(limit: number, offset: number) {
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
      Pick<Website, "id" | "user_id" | "url" | "label" | "is_active" | "auto_email_reports" | "report_frequency" | "created_at">
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
    Pick<Website, "id" | "user_id" | "url" | "label" | "is_active" | "auto_email_reports" | "report_frequency" | "created_at">
  >;
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

async function loadCompletedPdfRows(dedupeKeys: string[]) {
  if (!dedupeKeys.length) {
    return new Map<string, ReportGenerationQueueRow>();
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("report_generation_queue")
    .select("*")
    .eq("status", "completed")
    .in("dedupe_key", dedupeKeys);

  if (error) {
    throw new Error(error.message);
  }

  return new Map(((data ?? []) as ReportGenerationQueueRow[]).map((row) => [row.dedupe_key, row]));
}

async function loadExistingQueueRows(dedupeKeys: string[]) {
  if (!dedupeKeys.length) {
    return new Map<string, ReportEmailQueueRow>();
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("report_email_queue")
    .select("*")
    .in("dedupe_key", dedupeKeys);

  if (error) {
    throw new Error(error.message);
  }

  return new Map(((data ?? []) as ReportEmailQueueRow[]).map((row) => [row.dedupe_key, row]));
}

async function loadReport(reportId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("reports").select("*").eq("id", reportId).maybeSingle<Report>();

  if (error) {
    throw new Error(error.message);
  }

  return data ?? null;
}

async function insertQueueRows(rows: Array<Partial<ReportEmailQueueRow>>) {
  if (!rows.length) {
    return;
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("report_email_queue").insert(rows);

  if (error) {
    throw new Error(error.message);
  }
}

async function updateQueueRow(id: string, payload: Partial<ReportEmailQueueRow>) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("report_email_queue")
    .update({
      ...payload,
      updated_at: new Date().toISOString()
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

async function claimQueueRow(row: ReportEmailQueueRow, startedAt: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("report_email_queue")
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

async function loadQueueRowById(queueId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("report_email_queue")
    .select("*")
    .eq("id", queueId)
    .maybeSingle<ReportEmailQueueRow>();

  if (error) {
    throw new Error(error.message);
  }

  return data ?? null;
}

export async function enqueueDueReportEmails(limit = 200, offset = 0): Promise<EnqueueDueReportEmailsResult> {
  const profiles = await loadEligibleProfiles(limit, offset);
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const websites = await loadActiveWebsites(profiles.map((profile) => profile.id));
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

      const pdfDedupeKey = buildReportPdfQueueDedupeKey(website.id, frequency, periodKey);
      const dedupeKey = buildReportEmailQueueDedupeKey(website.id, frequency, periodKey);

      return {
        dedupeKey,
        pdfDedupeKey,
        baseRow: {
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
        }
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  const completedPdfRows = await loadCompletedPdfRows(candidates.map((row) => row.pdfDedupeKey));
  const existingRows = await loadExistingQueueRows(candidates.map((row) => row.dedupeKey));
  const rowsToInsert = candidates
    .filter((row) => completedPdfRows.has(row.pdfDedupeKey))
    .filter((row) => !existingRows.has(row.dedupeKey))
    .map((row) => {
      const pdfRow = completedPdfRows.get(row.pdfDedupeKey)!;

      return {
        ...row.baseRow,
        report_id: pdfRow.report_id,
        status: "pending" as const,
        failure_reason: null,
        last_error: null,
        metadata: {
          ...row.baseRow.metadata,
          reportGenerationQueueId: pdfRow.id,
          reportId: pdfRow.report_id,
          scanId: pdfRow.scan_id
        }
      };
    });

  await insertQueueRows(rowsToInsert);

  const nextOffset = profiles.length === limit ? offset + profiles.length : null;

  return {
    queuedCount: rowsToInsert.length,
    inspectedCount: profiles.length,
    nextOffset,
    hasMoreCandidates: nextOffset !== null
  };
}

async function processReportEmailQueueRow(row: ReportEmailQueueRow) {
  const startedAt = new Date().toISOString();

  try {
    const adminNow = createSupabaseAdminClient();
    const { data: website } = await adminNow
      .from("websites")
      .select("id,user_id,url,label,auto_email_reports,report_frequency")
      .eq("id", row.website_id)
      .maybeSingle<Website>();
    const { data: profile } = await adminNow
      .from("users")
      .select("id,email,plan,timezone,subscription_status,is_trial,trial_ends_at")
      .eq("id", row.user_id)
      .maybeSingle<
        Pick<
          UserProfile,
          "id" | "email" | "plan" | "timezone" | "subscription_status" | "is_trial" | "trial_ends_at"
        >
      >();

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
          : "Report emails are no longer enabled for this website.";
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

    const reportId =
      row.report_id ??
      (typeof row.metadata?.reportId === "string" ? row.metadata.reportId : null);

    if (!reportId) {
      throw new Error("A generated report is required before scheduled email delivery can run.");
    }

    const report = await loadReport(reportId);
    if (!report?.pdf_url) {
      throw new Error("A generated PDF report is required before scheduled email delivery can run.");
    }

    const delivery = await sendStoredReportEmail({
      reportId,
      skipAlreadySentRecipients: true,
      deliveryMode: "scheduled"
    });

    if (!delivery.deliveries.length) {
      const message = "Duplicate prevention skipped this scheduled report because it was already delivered.";
      await updateQueueRow(row.id, {
        report_id: reportId,
        status: "skipped",
        failure_reason: "already_sent",
        last_error: message,
        last_attempt_at: startedAt,
        sent_at: delivery.report.sent_at ?? new Date().toISOString()
      });

      return {
        status: "skipped" as const,
        message
      };
    }

    await updateQueueRow(row.id, {
      report_id: reportId,
      status: "sent",
      failure_reason: null,
      last_error: null,
      last_attempt_at: startedAt,
      sent_at: delivery.report.sent_at ?? new Date().toISOString()
    });

    return {
      status: "sent" as const,
      reportId
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown report email queue failure.";
    const failureReason = classifyEmailFailure(message);
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
      errorType: "email_failed",
      errorMessage: message,
      websiteId: row.website_id,
      userId: row.user_id,
      context: {
        queue: "report_email_queue",
        queueId: row.id,
        failureReason
      },
      dedupeWindowMinutes: 30
    });
    await logFailedTask({
      cronName: "process-report-emails",
      taskType: "send-report-email",
      userId: row.user_id,
      siteId: row.website_id,
      errorMessage: message,
      payload: {
        queueId: row.id,
        userId: row.user_id,
        websiteId: row.website_id,
        reportId: row.report_id,
        frequency: row.frequency
      }
    });

    return {
      status: "failed" as const,
      message
    };
  }
}

export async function retryReportEmailQueueTask(input: { queueId: string }) {
  const row = await loadQueueRowById(input.queueId);

  if (!row) {
    throw new Error("Report email queue row not found.");
  }

  return processReportEmailQueueRow(row);
}

export async function processQueuedReportEmails(
  limit = 25,
  guard?: CronExecutionGuard
): Promise<ProcessQueuedReportEmailsResult> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("report_email_queue")
    .select("*")
    .in("status", ["pending", "failed"])
    .lte("next_attempt_at", new Date().toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as ReportEmailQueueRow[];
  const sentReportIds: string[] = [];
  let inspectedCount = 0;

  for (const row of rows) {
    if (
      guard?.shouldStop({
        queue: "report_email_queue",
        processedCount: sentReportIds.length,
        queueId: row.id,
        websiteId: row.website_id
      })
    ) {
      break;
    }

    inspectedCount += 1;
    const result = await processReportEmailQueueRow(row);
    if (result.status === "sent" && result.reportId) {
      sentReportIds.push(result.reportId);
    }
  }

  return {
    sentReportIds,
    processedCount: sentReportIds.length,
    inspectedCount,
    hasMore: inspectedCount < rows.length || rows.length === limit
  };
}
