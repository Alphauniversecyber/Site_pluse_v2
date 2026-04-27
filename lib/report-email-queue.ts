import "server-only";

import type { ScanFrequency, ScanResult, UserProfile, Website } from "@/types";
import { logAdminError } from "@/lib/admin/logging";
import type { CronExecutionGuard } from "@/lib/cron";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { generateAndStoreReport, sendStoredReportEmail } from "@/lib/report-service";
import { getPeriodKey, getRetryAt, isDueForPeriod, normalizeTimezone } from "@/lib/schedule-monitoring";
import { PLAN_LIMITS } from "@/lib/utils";

type QueueStatus = "pending" | "processing" | "sent" | "failed" | "skipped";
type ReportQueueReason =
  | "smtp_failure"
  | "cron_not_triggered"
  | "frequency_mismatch"
  | "already_sent"
  | "queue_failure"
  | "missing_pdf_generation";

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

function buildReportQueueDedupeKey(websiteId: string, frequency: ScanFrequency, periodKey: string) {
  return `report-queue:${websiteId}:${frequency}:${periodKey}`;
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

  if (
    normalized.includes("pdf") ||
    normalized.includes("report not found") ||
    normalized.includes("download report") ||
    normalized.includes("generate report")
  ) {
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
    .select("id,email,plan,email_report_frequency,email_reports_enabled,timezone")
    .eq("email_reports_enabled", true)
    .in("plan", ["starter", "agency"])
    .order("created_at", { ascending: true })
    .range(offset, offset + Math.max(limit - 1, 0));

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Array<
    Pick<UserProfile, "id" | "email" | "plan" | "email_report_frequency" | "email_reports_enabled" | "timezone">
  >;
}

async function loadActiveWebsites(userIds: string[]) {
  if (!userIds.length) {
    return [] as Array<
      Pick<Website, "id" | "user_id" | "url" | "label" | "is_active" | "email_reports_enabled" | "email_report_frequency" | "created_at">
    >;
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("websites")
    .select("id,user_id,url,label,is_active,email_reports_enabled,email_report_frequency,created_at")
    .in("user_id", userIds)
    .eq("is_active", true)
    .eq("email_reports_enabled", true)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Array<
    Pick<Website, "id" | "user_id" | "url" | "label" | "is_active" | "email_reports_enabled" | "email_report_frequency" | "created_at">
  >;
}

async function loadLatestScans(websiteIds: string[]) {
  if (!websiteIds.length) {
    return new Map<string, ScanResult | null>();
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("scan_results")
    .select("id,website_id,scan_status,scanned_at")
    .in("website_id", websiteIds)
    .order("scanned_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const latest = new Map<string, ScanResult | null>();
  for (const row of (data ?? []) as Array<Pick<ScanResult, "id" | "website_id" | "scan_status" | "scanned_at">>) {
    if (!latest.has(row.website_id)) {
      latest.set(row.website_id, row as ScanResult);
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

export async function enqueueDueReportEmails(limit = 200, offset = 0): Promise<EnqueueDueReportEmailsResult> {
  const profiles = await loadEligibleProfiles(limit, offset);
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const websites = await loadActiveWebsites(profiles.map((profile) => profile.id));
  const latestScans = await loadLatestScans(websites.map((website) => website.id));
  const latestReports = await loadLatestSentReports(websites.map((website) => website.id));
  const now = new Date();

  const candidates = websites
    .map((website) => {
      const profile = profileById.get(website.user_id);

      if (!profile || !PLAN_LIMITS[profile.plan].emailReports) {
        return null;
      }

      const timezone = normalizeTimezone(profile.timezone);
      const frequency = website.email_report_frequency ?? profile.email_report_frequency;
      const periodKey = getPeriodKey(frequency, now, timezone);
      const latestSentAt = latestReports.get(website.id)?.sent_at ?? null;

      if (!isDueForPeriod({ frequency, lastEventAt: latestSentAt, timezone, reference: now })) {
        return null;
      }

      const latestScan = latestScans.get(website.id) ?? null;
      const dedupeKey = buildReportQueueDedupeKey(website.id, frequency, periodKey);
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
          websiteLabel: website.label,
          latestScanId: latestScan?.id ?? null,
          latestScanStatus: latestScan?.scan_status ?? null
        }
      };

      if (!latestScan || latestScan.scan_status === "failed") {
        return {
          ...baseRow,
          status: "failed" as const,
          failure_reason: "missing_pdf_generation" as const,
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

  await insertQueueRows(rowsToInsert);

  const nextOffset = profiles.length === limit ? offset + profiles.length : null;

  return {
    queuedCount: rowsToInsert.length,
    inspectedCount: profiles.length,
    nextOffset,
    hasMoreCandidates: nextOffset !== null
  };
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

    const startedAt = new Date().toISOString();

    try {
      const adminNow = createSupabaseAdminClient();
      const { data: website } = await adminNow
        .from("websites")
        .select("id,user_id,url,label,email_reports_enabled,email_report_frequency")
        .eq("id", row.website_id)
        .maybeSingle<Website>();
      const { data: profile } = await adminNow
        .from("users")
        .select("id,email,plan,email_reports_enabled,email_report_frequency,timezone")
        .eq("id", row.user_id)
        .maybeSingle<
          Pick<UserProfile, "id" | "email" | "plan" | "email_reports_enabled" | "email_report_frequency" | "timezone">
        >();

      if (!website || !profile || !website.email_reports_enabled || !profile.email_reports_enabled) {
        await updateQueueRow(row.id, {
          status: "skipped",
          failure_reason: "frequency_mismatch",
          last_error: "Report emails are no longer enabled for this website or user.",
          last_attempt_at: startedAt
        });
        continue;
      }

      const claimed = await claimQueueRow(row, startedAt);
      if (!claimed) {
        continue;
      }

      let reportId = row.report_id;
      if (!reportId) {
        const latestScanId =
          typeof row.metadata?.latestScanId === "string" ? row.metadata.latestScanId : null;

        if (!latestScanId) {
          throw new Error("No successful scan is available to generate the scheduled PDF report.");
        }

        const report = await generateAndStoreReport({
          websiteId: row.website_id,
          scanId: latestScanId
        });

        reportId = report.id;
      }

      const delivery = await sendStoredReportEmail({
        reportId,
        skipAlreadySentRecipients: true,
        deliveryMode: "scheduled"
      });

      if (!delivery.deliveries.length) {
        await updateQueueRow(row.id, {
          report_id: reportId,
          status: "skipped",
          failure_reason: "already_sent",
          last_error: "Duplicate prevention skipped this scheduled report because it was already delivered.",
          last_attempt_at: startedAt,
          sent_at: delivery.report.sent_at ?? new Date().toISOString()
        });
        continue;
      }

      await updateQueueRow(row.id, {
        report_id: reportId,
        status: "sent",
        failure_reason: null,
        last_error: null,
        last_attempt_at: startedAt,
        sent_at: delivery.report.sent_at ?? new Date().toISOString()
      });
      sentReportIds.push(reportId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown report queue failure.";
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
    }
  }

  return {
    sentReportIds,
    processedCount: sentReportIds.length,
    inspectedCount,
    hasMore: inspectedCount < rows.length || rows.length === limit
  };
}
