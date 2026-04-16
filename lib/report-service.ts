import "server-only";

import type {
  AgencyBranding,
  BrokenLinkRecord,
  CompetitorScanRecord,
  CruxDataRecord,
  Report,
  ScanResult,
  ScanFrequency,
  ScanSchedule,
  SecurityHeadersRecord,
  SeoAuditRecord,
  SslCheckRecord,
  UptimeCheckRecord,
  UserProfile,
  Website
} from "@/types";
import { logAdminError } from "@/lib/admin/logging";
import { ensureMagicTokenForWebsite } from "@/lib/client-token";
import { createCronExecutionGuard, getCronBatchLimit } from "@/lib/cron";
import { buildEmailDedupeKey } from "@/lib/email-utils";
import { generateScanPdf } from "@/lib/pdf";
import { buildHealthScore } from "@/lib/health-score";
import { sendReportEmail, trySendCriticalAlertEmail } from "@/lib/resend";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { canAccessFeature } from "@/lib/trial";
import { buildStoragePath } from "@/lib/utils";

async function loadReportContext(websiteId: string, scanId: string) {
  const admin = createSupabaseAdminClient();

  const { data: website } = await admin.from("websites").select("*").eq("id", websiteId).single<Website>();
  if (!website) {
    throw new Error("Website not found.");
  }

  const { data: scan } = await admin
    .from("scan_results")
    .select("*")
    .eq("id", scanId)
    .eq("website_id", websiteId)
    .single<ScanResult>();

  if (!scan) {
    throw new Error("Scan result not found.");
  }

  const { data: profile } = await admin.from("users").select("*").eq("id", website.user_id).single<UserProfile>();
  if (!profile) {
    throw new Error("User profile not found.");
  }

  const { data: branding } = await admin
    .from("agency_branding")
    .select("*")
    .eq("user_id", profile.id)
    .maybeSingle<AgencyBranding>();

  const { data: schedule } = await admin
    .from("scan_schedules")
    .select("*")
    .eq("website_id", website.id)
    .maybeSingle<ScanSchedule>();

  const [
    { data: history },
    { data: seoAuditByScan },
    { data: latestSeoAudit },
    { data: sslCheck },
    { data: securityHeaders },
    { data: cruxData },
    { data: brokenLinks },
    { data: uptimeChecks },
    { data: competitorScans }
  ] = await Promise.all([
    admin
      .from("scan_results")
      .select("*")
      .eq("website_id", website.id)
      .lte("scanned_at", scan.scanned_at)
      .order("scanned_at", { ascending: false })
      .limit(8),
    admin
      .from("seo_audit")
      .select("*")
      .eq("website_id", website.id)
      .eq("scan_id", scan.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<SeoAuditRecord>(),
    admin
      .from("seo_audit")
      .select("*")
      .eq("website_id", website.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<SeoAuditRecord>(),
    admin
      .from("ssl_checks")
      .select("*")
      .eq("website_id", website.id)
      .order("checked_at", { ascending: false })
      .limit(1)
      .maybeSingle<SslCheckRecord>(),
    admin
      .from("security_headers")
      .select("*")
      .eq("website_id", website.id)
      .order("checked_at", { ascending: false })
      .limit(1)
      .maybeSingle<SecurityHeadersRecord>(),
    admin
      .from("crux_data")
      .select("*")
      .eq("website_id", website.id)
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle<CruxDataRecord>(),
    admin
      .from("broken_links")
      .select("*")
      .eq("website_id", website.id)
      .order("scanned_at", { ascending: false })
      .limit(1)
      .maybeSingle<BrokenLinkRecord>(),
    admin
      .from("uptime_checks")
      .select("*")
      .eq("website_id", website.id)
      .order("checked_at", { ascending: false })
      .limit(120),
    admin
      .from("competitor_scans")
      .select("*")
      .eq("website_id", website.id)
      .order("scanned_at", { ascending: false })
      .limit(30)
  ]);

  const historyRows = ((history ?? []) as ScanResult[]).reverse();
  const previousScan =
    historyRows
      .slice()
      .reverse()
      .find((item) => item.id !== scan.id && item.scan_status !== "failed") ?? null;

  return {
    website,
    scan,
    profile,
    branding: branding ?? null,
    history: historyRows,
    previousScan,
    schedule: schedule ?? null,
    seoAudit: seoAuditByScan ?? latestSeoAudit ?? null,
    sslCheck: sslCheck ?? null,
    securityHeaders: securityHeaders ?? null,
    cruxData: cruxData ?? null,
    brokenLinks: brokenLinks ?? null,
    uptimeChecks: (uptimeChecks ?? []) as UptimeCheckRecord[],
    competitorScans: (competitorScans ?? []) as CompetitorScanRecord[]
  };
}

function getRecipients(profile: UserProfile, website: Website, explicitEmail?: string) {
  if (explicitEmail) {
    return [explicitEmail];
  }

  const recipients = [
    profile.email,
    ...(profile.extra_report_recipients ?? []),
    ...(website.report_recipients ?? [])
  ].filter(Boolean);

  return Array.from(new Set(recipients));
}

export async function generateAndStoreReport(input: { websiteId: string; scanId: string }) {
  const admin = createSupabaseAdminClient();
  let website: Website | null = null;

  try {
    const { data: existingReport } = await admin
      .from("reports")
      .select("*")
      .eq("website_id", input.websiteId)
      .eq("scan_id", input.scanId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<Report>();

    if (existingReport?.pdf_url) {
      return existingReport;
    }

    const {
      website: loadedWebsite,
      scan,
      profile,
      branding,
      history,
      previousScan,
      schedule,
      seoAudit,
      sslCheck,
      securityHeaders,
      cruxData,
      brokenLinks,
      uptimeChecks,
      competitorScans
    } = await loadReportContext(input.websiteId, input.scanId);
    website = loadedWebsite;

    if (!canAccessFeature(profile, "download_report")) {
      throw new Error("Your current plan does not include PDF reports.");
    }

    const pdfBuffer = await generateScanPdf({
      website,
      scan,
      branding,
      history,
      previousScan,
      profile,
      schedule,
      seoAudit,
      sslCheck,
      securityHeaders,
      cruxData,
      brokenLinks,
      uptimeChecks,
      competitorScans
    });

    const storagePath = buildStoragePath(
      website.user_id,
      `${website.label.replace(/\s+/g, "-").toLowerCase()}-${scan.id}.pdf`
    );

    const { error: uploadError } = await admin.storage.from("reports").upload(storagePath, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true
    });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const { data: existing } = await admin
      .from("reports")
      .select("*")
      .eq("website_id", website.id)
      .eq("scan_id", scan.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      const { data: updated, error } = await admin
        .from("reports")
        .update({
          pdf_url: storagePath
        })
        .eq("id", existing.id)
        .select("*")
        .single();

      if (error || !updated) {
        throw new Error(error?.message ?? "Unable to update report record.");
      }

      return updated as Report;
    }

    const { data: report, error } = await admin
      .from("reports")
      .insert({
        website_id: website.id,
        scan_id: scan.id,
        pdf_url: storagePath
      })
      .select("*")
      .single();

    if (error || !report) {
      throw new Error(error?.message ?? "Unable to create report.");
    }

    return report as Report;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to generate report PDF.";
    await logAdminError({
      errorType: "pdf_failed",
      errorMessage: message,
      websiteId: website?.id ?? input.websiteId,
      userId: website?.user_id,
      context: {
        websiteId: input.websiteId,
        scanId: input.scanId
      }
    });
    throw error;
  }
}

export async function getSignedReportUrl(reportId: string) {
  const admin = createSupabaseAdminClient();

  const { data: report } = await admin.from("reports").select("*").eq("id", reportId).single<Report>();
  if (!report) {
    throw new Error("Report not found.");
  }

  const { data, error } = await admin.storage.from("reports").createSignedUrl(report.pdf_url, 900);
  if (error || !data) {
    throw new Error(error?.message ?? "Unable to sign report URL.");
  }

  return {
    report,
    signedUrl: data.signedUrl
  };
}

export async function sendStoredReportEmail(input: {
  reportId: string;
  email?: string;
  skipAlreadySentRecipients?: boolean;
  deliveryMode?: "manual" | "scheduled";
}) {
  const admin = createSupabaseAdminClient();
  let report: Report | null = null;
  let website: Website | null = null;
  let profile: UserProfile | null = null;

  try {
    const { data: reportData } = await admin.from("reports").select("*").eq("id", input.reportId).single<Report>();
    if (!reportData) {
      throw new Error("Report not found.");
    }
    report = reportData;

    const {
      website: loadedWebsite,
      scan,
      profile: loadedProfile,
      branding,
      seoAudit,
      sslCheck,
      securityHeaders,
      brokenLinks,
      uptimeChecks
    } = await loadReportContext(report.website_id, report.scan_id);
    website = loadedWebsite;
    profile = loadedProfile;
    const deliveryMode = input.deliveryMode ?? "manual";
    const reportFrequency = website.email_report_frequency ?? profile.email_report_frequency;

    const { data: previousRows } = await admin
      .from("scan_results")
      .select("*")
      .eq("website_id", website.id)
      .lt("scanned_at", scan.scanned_at)
      .order("scanned_at", { ascending: false })
      .limit(1);

    const alreadyDeliveredRecipients = new Set(
      (report.sent_to_email ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    );
    const configuredRecipients = getRecipients(profile, website, input.email);
    const recipients = input.skipAlreadySentRecipients
      ? configuredRecipients.filter((recipient) => !alreadyDeliveredRecipients.has(recipient))
      : configuredRecipients;

    if (!configuredRecipients.length) {
      throw new Error("No report recipients configured.");
    }

    if (!recipients.length) {
      const sentAt = report.sent_at ?? new Date().toISOString();
      const { data: alreadyComplete, error: alreadyCompleteError } = await admin
        .from("reports")
        .update({
          sent_to_email: Array.from(alreadyDeliveredRecipients).join(", "),
          sent_at: sentAt
        })
        .eq("id", report.id)
        .select("*")
        .single();

      if (alreadyCompleteError || !alreadyComplete) {
        throw new Error(alreadyCompleteError?.message ?? "Unable to update report delivery status.");
      }

      return {
        report: alreadyComplete as Report,
        skippedRecipients: Array.from(alreadyDeliveredRecipients),
        deliveries: [] as Array<{
          recipient: string;
          messageId: string;
          provider: "resend";
        }>
      };
    }

    const { data: file, error: downloadError } = await admin.storage.from("reports").download(report.pdf_url);
    if (downloadError || !file) {
      throw new Error(downloadError?.message ?? "Unable to download report.");
    }

    const pdfBuffer = Buffer.from(await file.arrayBuffer());
    const healthScore = buildHealthScore({
      scan,
      seoAudit,
      sslCheck,
      securityHeaders,
      uptimeChecks
    }).overall;
    const dashboardToken = await ensureMagicTokenForWebsite(website.id);
    const dashboardBaseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ??
      process.env.APP_URL ??
      process.env.NEXT_PUBLIC_APP_URL ??
      "http://localhost:3000";
    const dashboardUrl = `${dashboardBaseUrl.replace(/\/$/, "")}/d/${dashboardToken}`;
    const deliveries: Array<{
      recipient: string;
      messageId: string;
      provider: "resend";
    }> = [];
    const skippedRecipients: string[] = [];

    for (const recipient of recipients) {
      try {
        const delivery = await sendReportEmail({
          to: recipient,
          reportId: report.id,
          website,
          profile,
          branding,
          scan,
          previousScan: (previousRows?.[0] as ScanResult | undefined) ?? null,
          healthScore,
          securityHeaders,
          brokenLinks,
          pdfBuffer,
          dashboardUrl,
          deliveryMode,
          frequency: reportFrequency,
          dedupeKey: buildEmailDedupeKey("report", report.id, recipient),
          triggeredAt: scan.scanned_at
        });

        if (delivery) {
          deliveries.push({
            recipient,
            messageId: delivery.messageId,
            provider: delivery.provider
          });
        } else {
          skippedRecipients.push(recipient);
        }
        alreadyDeliveredRecipients.add(recipient);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown email delivery error.";

        if (alreadyDeliveredRecipients.size) {
          await admin
            .from("reports")
            .update({
              sent_to_email: Array.from(alreadyDeliveredRecipients).join(", ")
            })
            .eq("id", report.id);
        }

        console.error("[reports:send] delivery_failed", {
          reportId: report.id,
          websiteId: website.id,
          recipient,
          deliveredRecipients: deliveries.map((item) => item.recipient),
          error: message
        });

        throw new Error(
          deliveries.length
            ? `Report delivery failed for ${recipient} after ${deliveries.length} successful email(s). ${message}`
            : `Report delivery failed for ${recipient}. ${message}`
        );
      }
    }

    const { data: updated, error } = await admin
      .from("reports")
      .update({
        sent_to_email: Array.from(alreadyDeliveredRecipients).join(", "),
        sent_at: new Date().toISOString()
      })
      .eq("id", report.id)
      .select("*")
      .single();

    if (error || !updated) {
      throw new Error(error?.message ?? "Unable to update report delivery status.");
    }

    if (deliveries.length) {
      await admin.from("notifications").insert({
        user_id: website.user_id,
        website_id: website.id,
        type: "report_ready",
        title: `Report sent for ${website.label}`,
        body: `${deliveryMode === "manual" ? "Manual" : "Scheduled"} report sent to ${deliveries.map((delivery) => delivery.recipient).join(", ")}.`,
        severity: "low",
        metadata: {
          reportId: report.id,
          messageIds: deliveries.map((delivery) => delivery.messageId),
          deliveryMode,
          reportFrequency
        }
      });
    }

    return {
      report: updated as Report,
      skippedRecipients,
      deliveries
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to send report email.";
    await logAdminError({
      errorType: "email_failed",
      errorMessage: message,
      websiteId: website?.id ?? report?.website_id,
      userId: profile?.id ?? website?.user_id,
      context: {
        reportId: report?.id ?? input.reportId,
        explicitEmail: input.email ?? null,
        skipAlreadySentRecipients: Boolean(input.skipAlreadySentRecipients)
      }
    });
    throw error;
  }
}

export async function processDueEmailReports(limit = getCronBatchLimit("REPORT_CRON_USER_LIMIT", 250)) {
  return processDueEmailReportsBatch({
    discoveryLimit: limit,
    discoveryOffset: 0
  });
}

export async function processDueEmailReportsBatch(input: {
  discoveryLimit?: number;
  discoveryOffset?: number;
  queueLimit?: number;
}) {
  const guard = createCronExecutionGuard("process-reports", 240_000);
  const { enqueueDueReportEmails, processQueuedReportEmails } = await import("@/lib/report-email-queue");
  const discoveryLimit = input.discoveryLimit ?? getCronBatchLimit("REPORT_CRON_USER_LIMIT", 250);
  const queueLimit = input.queueLimit ?? getCronBatchLimit("REPORT_QUEUE_BATCH_LIMIT", 10);
  const discoveryOffset = input.discoveryOffset ?? 0;
  let cursor: number | null = discoveryOffset;
  let queuedCount = 0;
  let inspectedCount = 0;
  let discoveryHasMore = false;
  let stoppedBeforeQueue = false;

  while (cursor !== null) {
    const enqueueResult = await enqueueDueReportEmails(discoveryLimit, cursor);
    queuedCount += enqueueResult.queuedCount;
    inspectedCount += enqueueResult.inspectedCount;
    discoveryHasMore = enqueueResult.hasMoreCandidates;
    cursor = enqueueResult.nextOffset;

    if (guard.shouldStop({ stage: "discovery", queue: "report_email_queue", nextOffset: enqueueResult.nextOffset })) {
      stoppedBeforeQueue = true;
      break;
    }

    if (!enqueueResult.hasMoreCandidates) {
      break;
    }
  }

  const queueResult = stoppedBeforeQueue
    ? {
        sentReportIds: [] as string[],
        processedCount: 0,
        inspectedCount: 0,
        hasMore: true
      }
    : await (async () => {
        const sentReportIds: string[] = [];
        let processedCount = 0;
        let queueInspectedCount = 0;
        let hasMore = false;

        while (true) {
          const batchResult = await processQueuedReportEmails(queueLimit, guard);
          sentReportIds.push(...batchResult.sentReportIds);
          processedCount += batchResult.processedCount;
          queueInspectedCount += batchResult.inspectedCount;
          hasMore = batchResult.hasMore;

          if (!batchResult.hasMore) {
            break;
          }

          if (
            guard.shouldStop({
              stage: "queue",
              queue: "report_email_queue",
              processedCount,
              inspectedCount: queueInspectedCount
            })
          ) {
            break;
          }
        }

        return {
          sentReportIds,
          processedCount,
          inspectedCount: queueInspectedCount,
          hasMore
        };
      })();

  return {
    sentReportIds: queueResult.sentReportIds,
    processedCount: queueResult.processedCount,
    inspectedCount: inspectedCount + queueResult.inspectedCount,
    queuedCount,
    nextCursor: cursor,
    hasMore: discoveryHasMore || queueResult.hasMore,
    discoveryHasMore,
    queueHasMore: queueResult.hasMore
  };
}
