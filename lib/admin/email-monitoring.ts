import "server-only";

import { getPlanLabel } from "@/lib/admin/format";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getLocalDayKey, getPeriodKey, isDueForPeriod, normalizeTimezone } from "@/lib/schedule-monitoring";
import { hasScheduledAutomationAccess } from "@/lib/trial";
import { PLAN_LIMITS } from "@/lib/utils";
import type { ReportFrequency, ScanFrequency, ScanResult, UserProfile, Website } from "@/types";

type QueueStatus = "pending" | "processing" | "sent" | "failed" | "skipped";
type PdfQueueStatus = "pending" | "processing" | "completed" | "failed" | "skipped";
type MonitoringRowStatus = "pending" | "processing" | "failed" | "skipped";
type EligibilityStatus =
  | "ready"
  | "plan_ineligible"
  | "user_disabled"
  | "website_disabled"
  | "missing_successful_scan";
type PipelineStage =
  | "missing_successful_scan"
  | "waiting_for_pdf"
  | "pdf_failed"
  | "pdf_ready"
  | "waiting_for_email"
  | "email_failed"
  | "email_sent";

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
  status: PdfQueueStatus;
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

type SentReportRow = {
  id: string;
  website_id: string;
  sent_at: string | null;
  sent_to_email: string | null;
  created_at: string;
};

type EmailCandidate = {
  id: string;
  userId: string;
  email: string;
  planLabel: string;
  websiteId: string;
  websiteLabel: string;
  websiteUrl: string;
  frequency: ScanFrequency;
  timezone: string;
  latestScan: Pick<ScanResult, "id" | "scan_status" | "scanned_at"> | null;
  latestSentAt: string | null;
  pdfQueueRow: ReportPdfQueueRow | null;
  emailQueueRow: ReportEmailQueueRow | null;
  sentReport: SentReportRow | null;
  stage: PipelineStage;
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
    dueToday: number;
    reportsGeneratedToday: number;
    sentToday: number;
    blockedPendingToday: number;
  };
  cron: {
    lastPdfRunAt: string | null;
    lastPdfRunStatus: string;
    lastPdfRunProcessed: number;
    lastEmailRunAt: string | null;
    lastEmailRunStatus: string;
    lastEmailRunProcessed: number;
  };
  chart: Array<{
    date: string;
    due: number;
    generated: number;
    sent: number;
  }>;
  eligibility: {
    summary: {
      totalActiveWebsites: number;
      ready: number;
      planIneligible: number;
      userDisabled: number;
      websiteDisabled: number;
      missingSuccessfulScan: number;
    };
    rows: Array<{
      id: string;
      userId: string;
      email: string;
      planLabel: string;
      websiteId: string;
      websiteLabel: string;
      websiteUrl: string;
      status: EligibilityStatus;
      reason: string;
      effectiveFrequency: ReportFrequency;
      latestSuccessfulScanAt: string | null;
      recipientCount: number;
      reportStatus: string | null;
      reportReason: string;
      lastReportAttempt: string | null;
      lastReportError: string | null;
    }>;
  };
  rows: AdminEmailMonitoringRow[];
  error: string | null;
};

function buildReportPdfQueueDedupeKey(websiteId: string, frequency: ScanFrequency, periodKey: string) {
  return `report-pdf:${websiteId}:${frequency}:${periodKey}`;
}

function buildReportEmailQueueDedupeKey(websiteId: string, frequency: ScanFrequency, periodKey: string) {
  return `report-email:${websiteId}:${frequency}:${periodKey}`;
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

function getStageReason(stage: PipelineStage, candidate: EmailCandidate) {
  if (stage === "missing_successful_scan") {
    return "A successful scan is required before SitePulse can generate the scheduled PDF report.";
  }
  if (stage === "waiting_for_pdf") {
    return "The report is due, but the PDF generation worker has not completed yet.";
  }
  if (stage === "pdf_failed") {
    return candidate.pdfQueueRow?.last_error ?? "PDF generation failed for the current report period.";
  }
  if (stage === "pdf_ready") {
    return "The scheduled PDF is ready and waiting for the email delivery stage.";
  }
  if (stage === "waiting_for_email") {
    return "The scheduled PDF exists, but the email delivery worker has not completed yet.";
  }
  if (stage === "email_failed") {
    return candidate.emailQueueRow?.last_error ?? "Scheduled report email delivery failed.";
  }
  return "The scheduled report email was sent for the current period.";
}

function buildChart(reference: Date, pdfQueueRows: ReportPdfQueueRow[], emailQueueRows: ReportEmailQueueRow[]) {
  return Array.from({ length: 7 }).map((_, index) => {
    const day = new Date(reference);
    day.setDate(reference.getDate() - (6 - index));
    const dayKey = toDayKey(day.toISOString());

    return {
      date: dayKey,
      due: pdfQueueRows.filter((row) => toDayKey(row.scheduled_for) === dayKey).length,
      generated: pdfQueueRows.filter((row) => row.status === "completed" && toDayKey(row.completed_at) === dayKey).length,
      sent: emailQueueRows.filter((row) => row.status === "sent" && toDayKey(row.sent_at) === dayKey).length
    };
  });
}

function toMonitoringRow(candidate: EmailCandidate): AdminEmailMonitoringRow {
  const stage = candidate.stage;
  const status: MonitoringRowStatus =
    stage === "waiting_for_pdf" || stage === "waiting_for_email"
      ? "pending"
      : stage === "pdf_ready"
        ? "processing"
        : stage === "email_failed" || stage === "pdf_failed" || stage === "missing_successful_scan"
          ? "failed"
          : "skipped";
  const lastAttempt =
    candidate.emailQueueRow?.last_attempt_at ??
    candidate.emailQueueRow?.updated_at ??
    candidate.pdfQueueRow?.last_attempt_at ??
    candidate.pdfQueueRow?.completed_at ??
    candidate.pdfQueueRow?.updated_at ??
    candidate.latestScan?.scanned_at ??
    null;
  const lastError = candidate.emailQueueRow?.last_error ?? candidate.pdfQueueRow?.last_error ?? null;

  return {
    id: candidate.id,
    userId: candidate.userId,
    email: candidate.email,
    planLabel: candidate.planLabel,
    websiteId: candidate.websiteId,
    websiteLabel: candidate.websiteLabel,
    websiteUrl: candidate.websiteUrl,
    status,
    reason: getStageReason(stage, candidate),
    lastAttempt,
    lastError
  };
}

function getEligibilityReason(status: EligibilityStatus) {
  if (status === "plan_ineligible") {
    return "This plan does not include scheduled PDF report emails.";
  }

  if (status === "user_disabled") {
    return "Scheduled reports are not available from the current configuration.";
  }

  if (status === "website_disabled") {
    return "The website-level scheduled email setting is disabled.";
  }

  if (status === "missing_successful_scan") {
    return "A successful scan is required before SitePulse can generate a scheduled PDF report.";
  }

  return "This website is ready for scheduled PDF report emails.";
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
    const [usersResult, websitesResult, scansResult, pdfQueueResult, emailQueueResult, pdfCronLogsResult, emailCronLogsResult, reportsResult] = await Promise.all([
      admin.from("users").select("id,email,plan,timezone,subscription_status,is_trial,trial_ends_at"),
      admin
        .from("websites")
        .select("id,user_id,url,label,is_active,auto_email_reports,report_frequency,extra_recipients,created_at")
        .eq("is_active", true),
      admin
        .from("scan_results")
        .select("id,website_id,scan_status,scanned_at")
        .gte("scanned_at", lookbackIso)
        .order("scanned_at", { ascending: false }),
      admin
        .from("report_generation_queue")
        .select("*")
        .gte("scheduled_for", queueLookbackIso)
        .order("scheduled_for", { ascending: false })
        .limit(5000),
      admin
        .from("report_email_queue")
        .select("*")
        .gte("scheduled_for", queueLookbackIso)
        .order("scheduled_for", { ascending: false })
        .limit(5000),
      admin
        .from("cron_logs")
        .select("started_at,status,items_processed")
        .eq("cron_name", "process-report-pdfs")
        .gte("started_at", queueLookbackIso)
        .order("started_at", { ascending: false })
        .limit(20),
      admin
        .from("cron_logs")
        .select("started_at,status,items_processed")
        .eq("cron_name", "process-report-emails")
        .gte("started_at", queueLookbackIso)
        .order("started_at", { ascending: false })
        .limit(20),
      admin
        .from("reports")
        .select("id,website_id,sent_at,sent_to_email,created_at")
        .gte("created_at", queueLookbackIso)
        .order("created_at", { ascending: false })
        .limit(5000)
    ]);

    if (usersResult.error) throw new Error(usersResult.error.message);
    if (websitesResult.error) throw new Error(websitesResult.error.message);
    if (scansResult.error) throw new Error(scansResult.error.message);
    if (pdfQueueResult.error) throw new Error(pdfQueueResult.error.message);
    if (emailQueueResult.error) throw new Error(emailQueueResult.error.message);
    if (pdfCronLogsResult.error) throw new Error(pdfCronLogsResult.error.message);
    if (emailCronLogsResult.error) throw new Error(emailCronLogsResult.error.message);
    if (reportsResult.error) throw new Error(reportsResult.error.message);

    const users = (usersResult.data ?? []) as Array<
      Pick<
        UserProfile,
        "id" | "email" | "plan" | "timezone" | "subscription_status" | "is_trial" | "trial_ends_at"
      >
    >;
    const websites = (websitesResult.data ?? []) as Array<
      Pick<
        Website,
        | "id"
        | "user_id"
        | "url"
        | "label"
        | "is_active"
        | "auto_email_reports"
        | "report_frequency"
        | "extra_recipients"
        | "created_at"
      >
    >;
    const scans = (scansResult.data ?? []) as Array<Pick<ScanResult, "id" | "website_id" | "scan_status" | "scanned_at">>;
    const pdfQueueRows = (pdfQueueResult.data ?? []) as ReportPdfQueueRow[];
    const emailQueueRows = (emailQueueResult.data ?? []) as ReportEmailQueueRow[];
    const pdfCronRows = (pdfCronLogsResult.data ?? []) as CronLogRow[];
    const emailCronRows = (emailCronLogsResult.data ?? []) as CronLogRow[];
    const reports = (reportsResult.data ?? []) as SentReportRow[];

    const usersById = new Map(users.map((user) => [user.id, user]));
    const latestScanByWebsite = new Map<string, Pick<ScanResult, "id" | "scan_status" | "scanned_at">>();
    const latestSuccessfulScanByWebsite = new Map<string, Pick<ScanResult, "id" | "scan_status" | "scanned_at">>();
    for (const row of scans) {
      if (!latestScanByWebsite.has(row.website_id)) {
        latestScanByWebsite.set(row.website_id, row);
      }

      if (row.scan_status === "success" && !latestSuccessfulScanByWebsite.has(row.website_id)) {
        latestSuccessfulScanByWebsite.set(row.website_id, row);
      }
    }

    const latestReportByWebsite = new Map<string, SentReportRow>();
    for (const row of reports) {
      if (!latestReportByWebsite.has(row.website_id)) {
        latestReportByWebsite.set(row.website_id, row);
      }
    }

    const pdfQueueByDedupeKey = new Map(pdfQueueRows.map((row) => [row.dedupe_key, row]));
    const emailQueueByDedupeKey = new Map(emailQueueRows.map((row) => [row.dedupe_key, row]));
    const latestPdfCron = pdfCronRows[0] ?? null;
    const latestEmailCron = emailCronRows[0] ?? null;

    const dueCandidates = websites
      .map((website) => {
        const user = usersById.get(website.user_id);
        if (
          !user ||
          !PLAN_LIMITS[user.plan]?.emailReports ||
          !hasScheduledAutomationAccess(user) ||
          !website.auto_email_reports
        ) {
          return null;
        }

        const timezone = normalizeTimezone(user.timezone);
        const frequencySetting = website.report_frequency ?? "weekly";
        if (frequencySetting === "never") {
          return null;
        }

        const frequency: ScanFrequency = frequencySetting;
        const latestSentAt = latestReportByWebsite.get(website.id)?.sent_at ?? null;

        if (!isDueForPeriod({ frequency, lastEventAt: latestSentAt, timezone, reference: now })) {
          return null;
        }

        const periodKey = getPeriodKey(frequency, now, timezone);
        const pdfQueueRow = pdfQueueByDedupeKey.get(buildReportPdfQueueDedupeKey(website.id, frequency, periodKey)) ?? null;
        const emailQueueRow =
          emailQueueByDedupeKey.get(buildReportEmailQueueDedupeKey(website.id, frequency, periodKey)) ?? null;
        const latestScan = latestSuccessfulScanByWebsite.get(website.id) ?? null;
        const sentReport = latestReportByWebsite.get(website.id) ?? null;
        const stage: PipelineStage =
          sentReport?.sent_at && getLocalDayKey(sentReport.sent_at, timezone) === getLocalDayKey(now, timezone)
            ? "email_sent"
            : !latestScan
              ? "missing_successful_scan"
              : pdfQueueRow?.status === "failed"
                ? "pdf_failed"
                : pdfQueueRow?.status === "completed"
                  ? emailQueueRow?.status === "sent"
                    ? "email_sent"
                    : emailQueueRow?.status === "failed"
                      ? "email_failed"
                      : emailQueueRow
                        ? "waiting_for_email"
                        : "pdf_ready"
                  : pdfQueueRow
                    ? "waiting_for_pdf"
                    : "waiting_for_pdf";

        return {
          id: `${website.id}:${periodKey}`,
          userId: user.id,
          email: user.email,
          planLabel: getPlanLabel(user.plan),
          websiteId: website.id,
          websiteLabel: website.label,
          websiteUrl: website.url,
          frequency,
          timezone,
          latestScan,
          latestSentAt,
          pdfQueueRow,
          emailQueueRow,
          sentReport,
          stage
        } satisfies EmailCandidate;
      })
      .filter((row): row is EmailCandidate => Boolean(row));

    const generatedToday = dueCandidates.filter(
      (candidate) =>
        candidate.pdfQueueRow?.status === "completed" &&
        candidate.pdfQueueRow.completed_at &&
        new Date(candidate.pdfQueueRow.completed_at).getTime() >= new Date(todayIso).getTime()
    ).length;
    const sentToday = dueCandidates.filter(
      (candidate) =>
        candidate.sentReport?.sent_at &&
        new Date(candidate.sentReport.sent_at).getTime() >= new Date(todayIso).getTime()
    ).length;
    const unresolvedRows = dueCandidates
      .filter((candidate) => candidate.stage !== "email_sent")
      .map((candidate) => toMonitoringRow(candidate));

    const eligibilityRows = websites
      .map((website) => {
        const user = usersById.get(website.user_id);

        if (!user) {
          return null;
        }

        const effectiveFrequency = website.report_frequency ?? "weekly";
        const latestSuccessfulScanAt = latestSuccessfulScanByWebsite.get(website.id)?.scanned_at ?? null;
        const recipientCount = Array.from(
          new Set([user.email, ...(website.extra_recipients ?? [])].filter(Boolean))
        ).length;

        let status: EligibilityStatus = "ready";
        if (!PLAN_LIMITS[user.plan]?.emailReports) {
          status = "plan_ineligible";
        } else if (!hasScheduledAutomationAccess(user)) {
          status = "user_disabled";
        } else if (!website.auto_email_reports || website.report_frequency === "never") {
          status = "website_disabled";
        } else if (!latestSuccessfulScanAt) {
          status = "missing_successful_scan";
        }

        const dueCandidate = dueCandidates.find((candidate) => candidate.websiteId === website.id) ?? null;
        const reportStatus =
          status !== "ready"
            ? null
            : dueCandidate?.stage === "email_sent"
              ? "sent"
              : dueCandidate?.stage === "pdf_ready"
                ? "pdf_ready"
                : dueCandidate?.stage === "waiting_for_email"
                  ? "waiting_for_email"
                  : dueCandidate?.stage === "email_failed"
                    ? "email_failed"
                    : dueCandidate?.stage === "pdf_failed"
                      ? "pdf_failed"
                      : dueCandidate?.stage === "waiting_for_pdf"
                        ? "waiting_for_pdf"
                        : dueCandidate?.stage === "missing_successful_scan"
                          ? "waiting_for_scan"
                          : "not_due";
        const reportReason =
          status !== "ready"
            ? "Blocked before scan/report scheduling."
            : dueCandidate
              ? getStageReason(dueCandidate.stage, dueCandidate)
              : "Ready for scheduled reports; no report is due right now.";
        const lastReportAttempt =
          dueCandidate?.emailQueueRow?.last_attempt_at ??
          dueCandidate?.emailQueueRow?.updated_at ??
          dueCandidate?.pdfQueueRow?.last_attempt_at ??
          dueCandidate?.pdfQueueRow?.completed_at ??
          dueCandidate?.pdfQueueRow?.updated_at ??
          null;
        const lastReportError = dueCandidate?.emailQueueRow?.last_error ?? dueCandidate?.pdfQueueRow?.last_error ?? null;

        return {
          id: `${website.id}:${status}`,
          userId: user.id,
          email: user.email,
          planLabel: getPlanLabel(user.plan),
          websiteId: website.id,
          websiteLabel: website.label,
          websiteUrl: website.url,
          status,
          reason: getEligibilityReason(status),
          effectiveFrequency,
          latestSuccessfulScanAt,
          recipientCount,
          reportStatus,
          reportReason,
          lastReportAttempt,
          lastReportError
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row));

    const filteredEligibilityRows = eligibilityRows.filter((row) => {
      const matchesUser =
        !userFilter ||
        row.email.toLowerCase().includes(userFilter) ||
        row.userId.toLowerCase().includes(userFilter) ||
        row.websiteUrl.toLowerCase().includes(userFilter) ||
        row.websiteLabel.toLowerCase().includes(userFilter);
      const matchesStatus =
        statusFilter === "all" ||
        row.status === statusFilter ||
        row.reportStatus === statusFilter;
      const matchesDate = matchesDateFilter(row.lastReportAttempt, dateFilter);

      return matchesUser && matchesStatus && matchesDate;
    });

    return {
      filters: {
        user: input?.user?.trim() ?? "",
        status: statusFilter,
        date: dateFilter
      },
      summary: {
        dueToday: dueCandidates.length,
        reportsGeneratedToday: generatedToday,
        sentToday,
        blockedPendingToday: Math.max(dueCandidates.length - sentToday, 0)
      },
      cron: {
        lastPdfRunAt: latestPdfCron?.started_at ?? null,
        lastPdfRunStatus: latestPdfCron?.status ?? "never",
        lastPdfRunProcessed: latestPdfCron?.items_processed ?? 0,
        lastEmailRunAt: latestEmailCron?.started_at ?? null,
        lastEmailRunStatus: latestEmailCron?.status ?? "never",
        lastEmailRunProcessed: latestEmailCron?.items_processed ?? 0
      },
      chart: buildChart(now, pdfQueueRows, emailQueueRows),
      eligibility: {
        summary: {
          totalActiveWebsites: websites.length,
          ready: eligibilityRows.filter((row) => row.status === "ready").length,
          planIneligible: eligibilityRows.filter((row) => row.status === "plan_ineligible").length,
          userDisabled: eligibilityRows.filter((row) => row.status === "user_disabled").length,
          websiteDisabled: eligibilityRows.filter((row) => row.status === "website_disabled").length,
          missingSuccessfulScan: eligibilityRows.filter((row) => row.status === "missing_successful_scan").length
        },
        rows: filteredEligibilityRows
      },
      rows: unresolvedRows.filter((row) => {
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
        dueToday: 0,
        reportsGeneratedToday: 0,
        sentToday: 0,
        blockedPendingToday: 0
      },
      cron: {
        lastPdfRunAt: null,
        lastPdfRunStatus: "never",
        lastPdfRunProcessed: 0,
        lastEmailRunAt: null,
        lastEmailRunStatus: "never",
        lastEmailRunProcessed: 0
      },
      chart: [],
      eligibility: {
        summary: {
          totalActiveWebsites: 0,
          ready: 0,
          planIneligible: 0,
          userDisabled: 0,
          websiteDisabled: 0,
          missingSuccessfulScan: 0
        },
        rows: []
      },
      rows: [],
      error: error instanceof Error ? error.message : "Unable to load email monitoring."
    };
  }
}
