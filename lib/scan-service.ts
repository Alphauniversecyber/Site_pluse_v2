import "server-only";

import type { ScanResult, SslCheckRecord, UserProfile, Website } from "@/types";
import { logAdminError } from "@/lib/admin/logging";
import { ensureBrokenLinkCheck } from "@/lib/broken-links";
import { createCronExecutionGuard, getCronBatchLimit } from "@/lib/cron";
import { buildEmailDedupeKey, escapeHtml, normalizeIssueKey } from "@/lib/email-utils";
import { ensureCruxData } from "@/lib/crux";
import { sendDay1Email } from "@/lib/lifecycle-email-service";
import { runAccessibilityScan } from "@/lib/pa11y";
import { runPageSpeedScan } from "@/lib/pagespeed";
import { sendProductEmail, trySendCriticalAlertEmail } from "@/lib/resend";
import {
  FRIENDLY_SCAN_FAILURE_MESSAGE,
  getFriendlyScanFailureMessage,
  isPageSpeedRateLimitError,
  shouldUseFriendlyScanFailureMessage
} from "@/lib/scan-errors";
import { getNextScheduledAt } from "@/lib/schedule-monitoring";
import { ensureSeoAudit } from "@/lib/seo-audit";
import { ensureSecurityHeadersCheck } from "@/lib/security-headers-checker";
import { ensureSslCheck, getSslAlertThreshold } from "@/lib/ssl-checker";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { PLAN_LIMITS, getBaseUrl } from "@/lib/utils";

type NotificationType =
  | "score_drop"
  | "critical_score"
  | "scan_failure"
  | "report_ready"
  | "accessibility_regression"
  | "ssl_expiry";

async function createNotification(input: {
  userId: string;
  websiteId: string;
  type: NotificationType;
  title: string;
  body: string;
  severity: "low" | "medium" | "high";
  metadata?: Record<string, unknown>;
}) {
  const admin = createSupabaseAdminClient();

  await admin.from("notifications").insert({
    user_id: input.userId,
    website_id: input.websiteId,
    type: input.type,
    title: input.title,
    body: input.body,
    severity: input.severity,
    metadata: input.metadata ?? {}
  });
}

async function getWebsiteContext(websiteId: string) {
  const admin = createSupabaseAdminClient();

  const { data: website, error: websiteError } = await admin
    .from("websites")
    .select("*")
    .eq("id", websiteId)
    .single<Website>();

  if (websiteError || !website) {
    throw new Error("Website not found.");
  }

  const { data: profile, error: profileError } = await admin
    .from("users")
    .select("*")
    .eq("id", website.user_id)
    .single<UserProfile>();

  if (profileError || !profile) {
    throw new Error("Website owner profile not found.");
  }

  const { data: schedule } = await admin
    .from("scan_schedules")
    .select("*")
    .eq("website_id", websiteId)
    .maybeSingle();

  return {
    website,
    profile,
    schedule: schedule ?? null
  };
}

async function maybeSendSslAlert(input: {
  profile: UserProfile;
  website: Website;
  scan: ScanResult;
  sslCheck: SslCheckRecord | null;
}) {
  if (!input.sslCheck) {
    return;
  }

  const threshold = getSslAlertThreshold(input.sslCheck);
  if (!threshold) {
    return;
  }

  const admin = createSupabaseAdminClient();
  const { data: priorAlerts } = await admin
    .from("notifications")
    .select("metadata")
    .eq("user_id", input.profile.id)
    .eq("website_id", input.website.id)
    .eq("type", "ssl_expiry")
    .order("created_at", { ascending: false })
    .limit(20);

  const alreadyAlerted = (priorAlerts ?? []).some((item) => {
    const metadata = (item.metadata ?? {}) as Record<string, unknown>;
    return (
      metadata.threshold === threshold &&
      metadata.expiryDate === (input.sslCheck?.expiry_date ?? null)
    );
  });

  if (alreadyAlerted) {
    return;
  }

  const reason =
    threshold === "expired"
      ? `${input.website.label} has an expired SSL certificate. Visitors may see security warnings right now.`
      : threshold === "7_days"
        ? `${input.website.label}'s SSL certificate expires in ${input.sslCheck.days_until_expiry} day(s). Renew it urgently to avoid downtime warnings.`
        : `${input.website.label}'s SSL certificate expires in ${input.sslCheck.days_until_expiry} day(s). Plan the renewal now to avoid service disruption.`;

  await createNotification({
    userId: input.profile.id,
    websiteId: input.website.id,
    type: "ssl_expiry",
    title:
      threshold === "expired"
        ? `SSL expired for ${input.website.label}`
        : `SSL renewal needed for ${input.website.label}`,
    body: reason,
    severity: threshold === "30_days" ? "medium" : "high",
    metadata: {
      threshold,
      expiryDate: input.sslCheck.expiry_date,
      daysUntilExpiry: input.sslCheck.days_until_expiry,
      issuer: input.sslCheck.issuer
    }
  });

  if (input.website.email_notifications ?? true) {
    await trySendCriticalAlertEmail({
      templateId: "alert_ssl_expiry",
      dedupeKey: buildEmailDedupeKey(
        "alert",
        "ssl_expiry",
        input.website.id,
        threshold,
        input.sslCheck.expiry_date ?? "unknown"
      ),
      to: input.profile.email,
      website: input.website,
      scan: input.scan,
      reason,
      triggeredAt: input.scan.scanned_at
    });
  }
}

function getWebsiteDashboardUrl(websiteId: string) {
  return `${getBaseUrl().replace(/\/$/, "")}/dashboard/websites/${websiteId}`;
}

function getHighPriorityIssueKeys(scan: ScanResult | null) {
  if (!scan) {
    return [];
  }

  return Array.from(
    new Set(
      scan.issues
        .filter((issue) => issue.severity === "high")
        .map((issue) => normalizeIssueKey(`${issue.title} ${issue.metric ?? ""}`))
        .filter(Boolean)
    )
  );
}

function getIssueTitlesForKeys(scan: ScanResult, keys: string[]) {
  const wanted = new Set(keys);

  return Array.from(
    new Set(
      scan.issues
        .filter((issue) => issue.severity === "high")
        .filter((issue) => wanted.has(normalizeIssueKey(`${issue.title} ${issue.metric ?? ""}`)))
        .map((issue) => issue.title.trim())
    )
  );
}

function renderIssueSummaryList(titles: string[]) {
  if (!titles.length) {
    return "";
  }

  return `
    <ul style="margin:0;padding-left:18px;color:#475569;font-size:15px;line-height:24px;">
      ${titles
        .slice(0, 3)
        .map((title) => `<li style="margin:0 0 8px 0;">${escapeHtml(title)}</li>`)
        .join("")}
    </ul>
  `;
}

function isExpectedSeoAuditFailure(message: string) {
  return /status 401|status 403|status 429|blocking automated requests/i.test(message);
}

async function trySendEngagementEmail(input: Parameters<typeof sendProductEmail>[0]) {
  try {
    await sendProductEmail(input);
  } catch (error) {
    console.warn("[scan:engagement_email_failed]", {
      templateId: input.templateId,
      dedupeKey: input.dedupeKey,
      userId: input.metadata?.userId,
      websiteId: input.metadata?.websiteId,
      scanId: input.metadata?.scanId,
      error: error instanceof Error ? error.message : "Unknown engagement email error"
    });
  }
}

async function pruneHistory(websiteId: string, plan: UserProfile["plan"]) {
  const admin = createSupabaseAdminClient();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - PLAN_LIMITS[plan].historyDays);

  await admin
    .from("scan_results")
    .delete()
    .eq("website_id", websiteId)
    .lt("scanned_at", cutoff.toISOString());
}

export async function executeWebsiteScan(
  websiteId: string,
  options?: {
    forceHealthSignals?: boolean;
    rotationIndex?: number;
  }
) {
  const admin = createSupabaseAdminClient();
  const { website, profile, schedule } = await getWebsiteContext(websiteId);
  const forceHealthSignals = options?.forceHealthSignals ?? false;

  const { data: priorRows } = await admin
    .from("scan_results")
    .select("*")
    .eq("website_id", website.id)
    .order("scanned_at", { ascending: false })
    .limit(6);

  const previousScans = (priorRows ?? []) as ScanResult[];
  const previousScan = previousScans[0] ?? null;
  const previousSuccessfulScan =
    previousScans.find((row) => row.scan_status !== "failed") ?? null;

  const [pageSpeedResult, accessibilityResult, sslCheckResult, securityHeadersResult] = await Promise.allSettled([
    runPageSpeedScan(website.url, {
      rotationIndex: options?.rotationIndex
    }),
    runAccessibilityScan(website.url),
    ensureSslCheck({
      websiteId: website.id,
      url: website.url,
      force: forceHealthSignals
    }),
    ensureSecurityHeadersCheck({
      websiteId: website.id,
      url: website.url,
      force: forceHealthSignals
    })
  ]);

  const pageSpeed =
    pageSpeedResult.status === "fulfilled"
      ? pageSpeedResult.value
      : {
          performance_score: 0,
          seo_score: 0,
          accessibility_score: 0,
          best_practices_score: 0,
          lcp: null,
          fid: null,
          cls: null,
          tbt: null,
          issues: [],
          recommendations: [],
          raw_data: {},
          mobile_snapshot: undefined,
          desktop_snapshot: undefined,
          scan_status: "failed" as const,
          error_message: getFriendlyScanFailureMessage(
            pageSpeedResult.reason instanceof Error
              ? pageSpeedResult.reason.message
              : "PageSpeed scan failed."
          )
        };

  const accessibility =
    accessibilityResult.status === "fulfilled"
      ? accessibilityResult.value
      : {
          accessibilityViolations: [] as Array<Record<string, unknown>>,
          issues: [],
          recommendations: [],
          raw: {},
          error:
            accessibilityResult.reason instanceof Error
              ? accessibilityResult.reason.message
              : "Accessibility scan failed."
        };

  const scanStatus = pageSpeedResult.status === "fulfilled" ? "success" : "failed";
  const normalizedPageSpeedError =
    pageSpeedResult.status === "rejected"
      ? getFriendlyScanFailureMessage(
          pageSpeedResult.reason instanceof Error ? pageSpeedResult.reason.message : "PageSpeed scan failed."
        )
      : null;
  const hasFriendlyPageSpeedFailure =
    pageSpeedResult.status === "rejected" &&
    (shouldUseFriendlyScanFailureMessage(
      pageSpeedResult.reason instanceof Error ? pageSpeedResult.reason.message : null
    ) ||
      isPageSpeedRateLimitError(pageSpeedResult.reason instanceof Error ? pageSpeedResult.reason.message : null));

  const errorMessages = hasFriendlyPageSpeedFailure
    ? [normalizedPageSpeedError ?? FRIENDLY_SCAN_FAILURE_MESSAGE]
    : [pageSpeed.error_message, accessibility.error].filter((value): value is string => Boolean(value));

  const { data: scan, error: insertError } = await admin
    .from("scan_results")
    .insert({
      website_id: website.id,
      performance_score: pageSpeed.performance_score,
      seo_score: pageSpeed.seo_score,
      accessibility_score: pageSpeed.accessibility_score,
      best_practices_score: pageSpeed.best_practices_score,
      lcp: pageSpeed.lcp,
      fid: pageSpeed.fid,
      cls: pageSpeed.cls,
      tbt: pageSpeed.tbt,
      issues: [...pageSpeed.issues, ...accessibility.issues],
      recommendations: [...pageSpeed.recommendations, ...accessibility.recommendations],
      accessibility_violations: accessibility.accessibilityViolations,
      raw_data: {
        pagespeed: pageSpeed.raw_data,
        accessibility: accessibility.raw
      },
      mobile_snapshot: pageSpeed.mobile_snapshot ?? {},
      desktop_snapshot: pageSpeed.desktop_snapshot ?? {},
      scan_status: scanStatus,
      error_message: errorMessages.length ? errorMessages.join(" | ") : null,
      scanned_at: new Date().toISOString()
    })
    .select("*")
    .single();

  if (insertError || !scan) {
    throw new Error(insertError?.message ?? "Unable to persist scan result.");
  }

  const frequency =
    (schedule?.frequency as "daily" | "weekly" | "monthly" | undefined) ??
    PLAN_LIMITS[profile.plan].scanFrequencies[0];

  const schedulePayload = {
    website_id: website.id,
    frequency,
    last_scan_at: new Date().toISOString(),
    next_scan_at: getNextScheduledAt(frequency)
  };

  if (schedule?.id) {
    await admin.from("scan_schedules").update(schedulePayload).eq("id", schedule.id);
  } else {
    await admin.from("scan_schedules").insert(schedulePayload);
  }

  const currentScan = scan as ScanResult;
  const [seoAuditResult, brokenLinksResult, cruxDataResult] = await Promise.allSettled([
    ensureSeoAudit({
      websiteId: website.id,
      scanId: currentScan.id,
      url: website.url,
      force: forceHealthSignals,
      suppressExpectedFailure: true
    }),
    ensureBrokenLinkCheck({
      websiteId: website.id,
      url: website.url,
      scanId: currentScan.id,
      force: forceHealthSignals
    }),
    ensureCruxData({
      websiteId: website.id,
      url: website.url
    })
  ]);
  const sslCheck =
    sslCheckResult.status === "fulfilled"
      ? sslCheckResult.value
      : null;
  const seoAudit =
    seoAuditResult.status === "fulfilled"
      ? seoAuditResult.value
      : null;
  const cruxData =
    cruxDataResult.status === "fulfilled"
      ? cruxDataResult.value
      : null;
  const brokenLinks =
    brokenLinksResult.status === "fulfilled"
      ? brokenLinksResult.value
      : null;
  const securityHeaders =
    securityHeadersResult.status === "fulfilled"
      ? securityHeadersResult.value
      : null;

  if (seoAuditResult.status === "rejected") {
    const message =
      seoAuditResult.reason instanceof Error ? seoAuditResult.reason.message : "Unknown SEO audit error";
    const log = isExpectedSeoAuditFailure(message) ? console.info : console.warn;

    log("[scan:seo_audit_failed]", {
      websiteId: website.id,
      scanId: currentScan.id,
      error: message
    });
  }

  if (brokenLinksResult.status === "rejected") {
    console.warn("[scan:broken_links_failed]", {
      websiteId: website.id,
      scanId: currentScan.id,
      error:
        brokenLinksResult.reason instanceof Error
          ? brokenLinksResult.reason.message
          : "Unknown broken link error"
    });
  }
  const currentAccessibilityCount =
    currentScan.accessibility_violations?.length ??
    ((currentScan.raw_data as { accessibility?: { accessibilityViolations?: unknown[] } }).accessibility
      ?.accessibilityViolations?.length ?? 0);
  const previousAccessibilityCount =
    previousScan?.accessibility_violations?.length ??
    ((previousScan?.raw_data as { accessibility?: { accessibilityViolations?: unknown[] } } | undefined)
      ?.accessibility?.accessibilityViolations?.length ?? 0);
  const currentHighPriorityIssueKeys = getHighPriorityIssueKeys(currentScan);
  const previousHighPriorityIssueKeys = getHighPriorityIssueKeys(previousSuccessfulScan);

  if (currentScan.scan_status === "failed") {
    await logAdminError({
      errorType: "scan_failed",
      errorMessage: currentScan.error_message ?? "The site was unreachable during the latest scan.",
      websiteId: website.id,
      userId: profile.id,
      context: {
        scanId: currentScan.id
      }
    });

    await createNotification({
      userId: profile.id,
      websiteId: website.id,
      type: "scan_failure",
      title: `Scan failed for ${website.label}`,
      body: currentScan.error_message ?? "The site was unreachable during the latest scan.",
      severity: "high",
      metadata: {
        scanId: currentScan.id
      }
    });

    if (website.email_notifications ?? true) {
      await trySendCriticalAlertEmail({
        templateId: "alert_scan_failure",
        dedupeKey: buildEmailDedupeKey("alert", "scan_failure", website.id, currentScan.id),
        to: profile.email,
        website,
        scan: currentScan,
        reason: currentScan.error_message ?? "The latest scan failed.",
        triggeredAt: currentScan.scanned_at
      });
    }
  } else {
    const previousScore = previousSuccessfulScan?.performance_score ?? null;
    const delta = previousScore !== null ? currentScan.performance_score - previousScore : null;

    if (!previousSuccessfulScan) {
      await trySendEngagementEmail({
        templateId: "first_scan_ready",
        dedupeKey: buildEmailDedupeKey("engagement", "first_scan_ready", website.id),
        campaign: "engagement",
        to: profile.email,
        subject: `Your first scan is ready for ${website.label}`,
        preheader: `The first SitePulse scan for ${website.label} is ready with scores, issues, and next steps.`,
        eyebrow: "First scan ready",
        title: `${website.label} is ready to review`,
        summary: "The first scan is complete, so you now have a clean baseline for performance, SEO, accessibility, and best-practice follow-up.",
        bodyHtml: `
          <p style="margin:0 0 14px 0;font-size:15px;line-height:24px;color:#475569;">
            Open the website workspace to review the score breakdown, turn the strongest findings into action, and decide when you want to generate the first client-facing report.
          </p>
          <p style="margin:0;font-size:15px;line-height:24px;color:#475569;">
            This is the best moment to sanity-check the baseline before future scans start showing trend changes.
          </p>
        `,
        ctaLabel: "Review the first scan",
        ctaUrl: getWebsiteDashboardUrl(website.id),
        secondaryLabel: "Open reports",
        secondaryUrl: `${getBaseUrl().replace(/\/$/, "")}/dashboard/reports`,
        details: [
          {
            label: "Performance",
            value: String(currentScan.performance_score)
          },
          {
            label: "SEO",
            value: String(currentScan.seo_score)
          },
          {
            label: "Accessibility",
            value: String(currentScan.accessibility_score)
          }
        ],
        metadata: {
          websiteId: website.id,
          userId: profile.id,
          scanId: currentScan.id
        },
        triggeredAt: currentScan.scanned_at
      });

      const topIssues = [...currentScan.issues]
        .sort((left, right) => {
          const severityOrder = { high: 3, medium: 2, low: 1 };
          return severityOrder[right.severity] - severityOrder[left.severity];
        })
        .slice(0, 3)
        .map((issue) => ({
          title: issue.title,
          description: issue.description
        }));

      await sendDay1Email(profile, {
        domain: website.url.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/.*$/, ""),
        websiteId: website.id,
        scanId: currentScan.id,
        scannedAt: currentScan.scanned_at,
        topIssues
      });
    }

    if (delta !== null && delta <= -10) {
      const reason = `${website.label} dropped ${Math.abs(delta)} points since the previous scan.`;

      await createNotification({
        userId: profile.id,
        websiteId: website.id,
        type: "score_drop",
        title: `Performance dropped on ${website.label}`,
        body: reason,
        severity: "high",
        metadata: {
          delta,
          scanId: currentScan.id
        }
      });

      if (website.email_notifications ?? true) {
        await trySendCriticalAlertEmail({
          templateId: "alert_score_drop",
          dedupeKey: buildEmailDedupeKey("alert", "score_drop", website.id, currentScan.id),
          to: profile.email,
          website,
          scan: currentScan,
          reason,
          triggeredAt: currentScan.scanned_at
        });
      }
    }

    if (currentScan.performance_score < 50 && (previousScore === null || previousScore >= 50)) {
      const reason = `${website.label} is now below a performance score of 50.`;

      await createNotification({
        userId: profile.id,
        websiteId: website.id,
        type: "critical_score",
        title: `${website.label} is in the critical zone`,
        body: reason,
        severity: "high",
        metadata: {
          score: currentScan.performance_score,
          scanId: currentScan.id
        }
      });

      if (website.email_notifications ?? true) {
        await trySendCriticalAlertEmail({
          templateId: "alert_critical_score",
          dedupeKey: buildEmailDedupeKey("alert", "critical_score", website.id, currentScan.id),
          to: profile.email,
          website,
          scan: currentScan,
          reason,
          triggeredAt: currentScan.scanned_at
        });
      }
    }

    if ((website.email_notifications ?? true) && delta !== null && delta >= 8) {
      await trySendEngagementEmail({
        templateId: "score_improved",
        dedupeKey: buildEmailDedupeKey("engagement", "score_improved", website.id, currentScan.id),
        campaign: "engagement",
        to: profile.email,
        subject: `Good news: ${website.label} improved by ${delta} points`,
        preheader: `${website.label} improved by ${delta} performance points in the latest SitePulse scan.`,
        eyebrow: "Score improved",
        title: `${website.label} moved in the right direction`,
        summary: "The latest scan shows meaningful score improvement, which is a useful moment to reinforce momentum and package the win clearly.",
        bodyHtml: `
          <p style="margin:0 0 14px 0;font-size:15px;line-height:24px;color:#475569;">
            Performance improved by ${escapeHtml(delta)} points compared with the previous successful scan. Review what changed, lock in the win, and decide whether it is worth highlighting in the next client update.
          </p>
          <p style="margin:0;font-size:15px;line-height:24px;color:#475569;">
            When score gains are fresh, it is easier to connect the technical changes to business confidence and forward progress.
          </p>
        `,
        ctaLabel: "Review the latest scan",
        ctaUrl: getWebsiteDashboardUrl(website.id),
        secondaryLabel: "Open reports",
        secondaryUrl: `${getBaseUrl().replace(/\/$/, "")}/dashboard/reports`,
        details: [
          {
            label: "Previous score",
            value: String(previousScore)
          },
          {
            label: "Current score",
            value: String(currentScan.performance_score)
          },
          {
            label: "Change",
            value: `+${delta}`
          }
        ],
        metadata: {
          websiteId: website.id,
          userId: profile.id,
          scanId: currentScan.id,
          delta
        },
        triggeredAt: currentScan.scanned_at
      });
    }

    if ((website.email_notifications ?? true) && previousSuccessfulScan) {
      const fixedIssueKeys = previousHighPriorityIssueKeys.filter(
        (key) => !currentHighPriorityIssueKeys.includes(key)
      );

      if (fixedIssueKeys.length) {
        const issueTitles = getIssueTitlesForKeys(previousSuccessfulScan, fixedIssueKeys);

        await trySendEngagementEmail({
          templateId: "issue_fixed",
          dedupeKey: buildEmailDedupeKey("engagement", "issue_fixed", website.id, currentScan.id),
          campaign: "engagement",
          to: profile.email,
          subject: `Nice work: issues were resolved on ${website.label}`,
          preheader: `${fixedIssueKeys.length} high-priority issue(s) are no longer showing on ${website.label}.`,
          eyebrow: "Issue fixed",
          title: `${website.label} cleared key issues`,
          summary: "The latest scan no longer shows one or more previously high-priority problems, which is a strong checkpoint worth keeping visible.",
          bodyHtml: `
            <p style="margin:0 0 14px 0;font-size:15px;line-height:24px;color:#475569;">
              One or more high-priority issues dropped out of the latest scan results. That is usually worth confirming, documenting, and carrying into the next client-facing update.
            </p>
            ${renderIssueSummaryList(issueTitles)}
          `,
          ctaLabel: "Review resolved issues",
          ctaUrl: getWebsiteDashboardUrl(website.id),
          details: [
            {
              label: "Resolved",
              value: String(fixedIssueKeys.length)
            },
            {
              label: "Previous high-priority",
              value: String(previousHighPriorityIssueKeys.length)
            },
            {
              label: "Current high-priority",
              value: String(currentHighPriorityIssueKeys.length)
            }
          ],
          metadata: {
            websiteId: website.id,
            userId: profile.id,
            scanId: currentScan.id,
            issueKeys: fixedIssueKeys,
            issueTitles
          },
          triggeredAt: currentScan.scanned_at
        });
      }
    }

    if (currentAccessibilityCount > previousAccessibilityCount && previousScan) {
      await createNotification({
        userId: profile.id,
        websiteId: website.id,
        type: "accessibility_regression",
        title: `Accessibility issues increased on ${website.label}`,
        body: `${currentAccessibilityCount - previousAccessibilityCount} new accessibility issue(s) were detected.`,
        severity: "medium",
        metadata: {
          previousAccessibilityCount,
          currentAccessibilityCount,
          scanId: currentScan.id
        }
      });
    }
  }

  if (sslCheck) {
    await maybeSendSslAlert({
      profile,
      website,
      scan: currentScan,
      sslCheck
    });
  }

  await pruneHistory(website.id, profile.plan);

  return {
    website,
    profile,
    scan: currentScan,
    sslCheck,
    securityHeaders,
    seoAudit,
    cruxData,
    brokenLinks
  };
}

export async function processDueScans(limit = getCronBatchLimit("SCAN_CRON_LIMIT", 250)) {
  return processDueScansBatch({
    discoveryLimit: limit,
    discoveryOffset: 0
  });
}

export async function processDueScansBatch(input: {
  discoveryLimit?: number;
  discoveryOffset?: number;
  queueLimit?: number;
}) {
  const guard = createCronExecutionGuard("process-scans", 240_000);
  const { enqueueDueScanJobs, processQueuedScanJobs } = await import("@/lib/scan-job-queue");
  const discoveryLimit = input.discoveryLimit ?? getCronBatchLimit("SCAN_CRON_LIMIT", 250);
  const queueLimit = input.queueLimit ?? getCronBatchLimit("SCAN_QUEUE_BATCH_LIMIT", 6);
  const discoveryOffset = input.discoveryOffset ?? 0;
  let cursor: number | null = discoveryOffset;
  let queuedCount = 0;
  let inspectedCount = 0;
  let discoveryHasMore = false;
  let stoppedBeforeQueue = false;

  while (cursor !== null) {
    const enqueueResult = await enqueueDueScanJobs(discoveryLimit, cursor);
    queuedCount += enqueueResult.queuedCount;
    inspectedCount += enqueueResult.inspectedCount;
    discoveryHasMore = enqueueResult.hasMoreCandidates;
    cursor = enqueueResult.nextOffset;

    if (guard.shouldStop({
      stage: "discovery",
      queue: "scan_job_queue",
      nextOffset: enqueueResult.nextOffset,
      inspectedCount
    })) {
      stoppedBeforeQueue = true;
      break;
    }

    if (!enqueueResult.hasMoreCandidates) {
      break;
    }
  }

  const queueResult = stoppedBeforeQueue
    ? {
        executedWebsiteIds: [] as string[],
        processedCount: 0,
        inspectedCount: 0,
        hasMore: true
      }
    : await (async () => {
        const executedWebsiteIds: string[] = [];
        let processedCount = 0;
        let queueInspectedCount = 0;
        let hasMore = false;

        while (true) {
          const batchResult = await processQueuedScanJobs(queueLimit, guard);
          executedWebsiteIds.push(...batchResult.executedWebsiteIds);
          processedCount += batchResult.processedCount;
          queueInspectedCount += batchResult.inspectedCount;
          hasMore = batchResult.hasMore;

          if (!batchResult.hasMore) {
            break;
          }

          if (
            guard.shouldStop({
              stage: "queue",
              queue: "scan_job_queue",
              processedCount,
              inspectedCount: queueInspectedCount
            })
          ) {
            break;
          }
        }

        return {
          executedWebsiteIds,
          processedCount,
          inspectedCount: queueInspectedCount,
          hasMore
        };
      })();

  return {
    processedIds: queueResult.executedWebsiteIds,
    processedCount: queueResult.processedCount,
    inspectedCount: inspectedCount + queueResult.inspectedCount,
    queuedCount,
    nextCursor: cursor,
    hasMore: discoveryHasMore || queueResult.hasMore,
    discoveryHasMore,
    queueHasMore: queueResult.hasMore
  };
}
