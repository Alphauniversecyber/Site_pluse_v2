import "server-only";

import type { ScanResult, UserProfile, Website } from "@/types";
import { runAccessibilityScan } from "@/lib/pa11y";
import { runPageSpeedScan } from "@/lib/pagespeed";
import { sendCriticalAlertEmail } from "@/lib/resend";
import { FRIENDLY_SCAN_FAILURE_MESSAGE, getFriendlyScanFailureMessage, shouldUseFriendlyScanFailureMessage } from "@/lib/scan-errors";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { PLAN_LIMITS } from "@/lib/utils";

type NotificationType =
  | "score_drop"
  | "critical_score"
  | "scan_failure"
  | "report_ready"
  | "accessibility_regression";

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

function getNextScanAt(frequency: "daily" | "weekly" | "monthly") {
  const next = new Date();

  if (frequency === "daily") {
    next.setDate(next.getDate() + 1);
  } else if (frequency === "weekly") {
    next.setDate(next.getDate() + 7);
  } else {
    next.setMonth(next.getMonth() + 1);
  }

  return next.toISOString();
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

export async function executeWebsiteScan(websiteId: string) {
  const admin = createSupabaseAdminClient();
  const { website, profile, schedule } = await getWebsiteContext(websiteId);

  const { data: priorRows } = await admin
    .from("scan_results")
    .select("*")
    .eq("website_id", website.id)
    .order("scanned_at", { ascending: false })
    .limit(1);

  const previousScan = (priorRows?.[0] as ScanResult | undefined) ?? null;

  const [pageSpeedResult, accessibilityResult] = await Promise.allSettled([
    runPageSpeedScan(website.url),
    runAccessibilityScan(website.url)
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
  const hasFriendlyPageSpeedFailure =
    pageSpeedResult.status === "rejected" &&
    shouldUseFriendlyScanFailureMessage(
      pageSpeedResult.reason instanceof Error ? pageSpeedResult.reason.message : null
    );

  const errorMessages = hasFriendlyPageSpeedFailure
    ? [FRIENDLY_SCAN_FAILURE_MESSAGE]
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
    next_scan_at: getNextScanAt(frequency)
  };

  if (schedule?.id) {
    await admin.from("scan_schedules").update(schedulePayload).eq("id", schedule.id);
  } else {
    await admin.from("scan_schedules").insert(schedulePayload);
  }

  const currentScan = scan as ScanResult;
  const currentAccessibilityCount =
    currentScan.accessibility_violations?.length ??
    ((currentScan.raw_data as { accessibility?: { accessibilityViolations?: unknown[] } }).accessibility
      ?.accessibilityViolations?.length ?? 0);
  const previousAccessibilityCount =
    previousScan?.accessibility_violations?.length ??
    ((previousScan?.raw_data as { accessibility?: { accessibilityViolations?: unknown[] } } | undefined)
      ?.accessibility?.accessibilityViolations?.length ?? 0);

  if (currentScan.scan_status === "failed") {
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

    if (profile.email_notifications_enabled) {
      await sendCriticalAlertEmail({
        to: profile.email,
        website,
        scan: currentScan,
        reason: currentScan.error_message ?? "The latest scan failed."
      });
    }
  } else {
    const previousScore = previousScan?.performance_score ?? null;
    const delta = previousScore !== null ? currentScan.performance_score - previousScore : null;

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

      if (profile.email_notifications_enabled) {
        await sendCriticalAlertEmail({
          to: profile.email,
          website,
          scan: currentScan,
          reason
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

      if (profile.email_notifications_enabled) {
        await sendCriticalAlertEmail({
          to: profile.email,
          website,
          scan: currentScan,
          reason
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

  await pruneHistory(website.id, profile.plan);

  return {
    website,
    profile,
    scan: currentScan
  };
}

export async function processDueScans(limit = 20) {
  const admin = createSupabaseAdminClient();
  const { data: schedules, error } = await admin
    .from("scan_schedules")
    .select("id, website_id, next_scan_at")
    .lte("next_scan_at", new Date().toISOString())
    .order("next_scan_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  const executed: string[] = [];

  for (const schedule of schedules ?? []) {
    const { data: website } = await admin
      .from("websites")
      .select("id, is_active")
      .eq("id", schedule.website_id)
      .single();

    if (!website?.is_active) {
      continue;
    }

    await executeWebsiteScan(schedule.website_id);
    executed.push(schedule.website_id);
  }

  return executed;
}
