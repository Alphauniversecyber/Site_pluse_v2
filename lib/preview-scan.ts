import "server-only";

import { buildHealthScore } from "@/lib/health-score";
import { runAccessibilityScan } from "@/lib/pa11y";
import { runPageSpeedScan } from "@/lib/pagespeed";
import { ensureCruxData } from "@/lib/crux";
import { ensureSecurityHeadersCheck } from "@/lib/security-headers-checker";
import { ensureSeoAudit } from "@/lib/seo-audit";
import { ensureSslCheck } from "@/lib/ssl-checker";
import { buildSiteBusinessImpact } from "@/lib/business-impact";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { PLAN_LIMITS, normalizeUrl } from "@/lib/utils";
import type {
  PreviewScanIssue,
  PreviewScanPayload,
  PreviewScanResult,
  PreviewScanSessionRecord,
  ScanIssue,
  ScanResult,
  ScanSchedule,
  UserProfile,
  Website
} from "@/types";

const PREVIEW_SESSION_TTL_HOURS = 24;

function cleanText(value: string, maxLength = 130) {
  const cleaned = value
    .replace(/\s+/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .trim();

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  const shortened = cleaned.slice(0, maxLength);
  const boundary = shortened.search(/\s+\S*$/);
  return `${(boundary > 32 ? shortened.slice(0, boundary) : shortened).trim()}.`;
}

function titleCase(value: string) {
  return value
    .split(/[\s-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildWebsiteLabel(url: string) {
  try {
    const host = new URL(url).hostname.replace(/^www\./i, "");
    return titleCase(host.split(".")[0] ?? host);
  } catch {
    return "Client Website";
  }
}

function categoryFromIssue(issue: ScanIssue) {
  const haystack = `${issue.title} ${issue.description}`.toLowerCase();

  if (/(seo|meta|canonical|search|schema|robots|sitemap)/i.test(haystack)) {
    return "seo";
  }

  if (/(access|aria|label|alt|contrast|keyboard)/i.test(haystack)) {
    return "accessibility";
  }

  if (/(security|https|cookie|privacy|trust|unsafe)/i.test(haystack)) {
    return "security";
  }

  return "performance";
}

function normalizeIssueKey(issue: ScanIssue) {
  return cleanText(issue.title.toLowerCase(), 90).replace(/[^a-z0-9]+/g, " ").trim();
}

function toPreviewIssue(issue: ScanIssue): PreviewScanIssue {
  const category = categoryFromIssue(issue);

  if (category === "seo") {
    return {
      id: issue.id,
      title: cleanText(issue.title, 60),
      summary:
        "Search signals are weaker than they should be, so the right visitors may not reach this site consistently.",
      why_it_matters:
        "Lower search visibility quietly reduces qualified traffic, enquiries, and the value you can prove to clients."
    };
  }

  if (category === "accessibility") {
    return {
      id: issue.id,
      title: cleanText(issue.title, 60),
      summary:
        "Important content or actions are harder to use than they should be across mobile and desktop journeys.",
      why_it_matters:
        "When visitors struggle to read, navigate, or take action, trust drops and conversion rates usually follow."
    };
  }

  if (category === "security") {
    return {
      id: issue.id,
      title: cleanText(issue.title, 60),
      summary:
        "Trust or compliance signals need attention, which can make the website feel less dependable to visitors.",
      why_it_matters:
        "Low-confidence experiences reduce trust quickly, especially for new visitors deciding whether to contact or buy."
    };
  }

  return {
    id: issue.id,
    title: cleanText(issue.title, 60),
    summary:
      "The website is loading slower than visitors expect, which creates friction before they can see the offer clearly.",
    why_it_matters:
      "Slow experiences reduce engagement, hurt conversions, and make client retention conversations harder."
  };
}

function buildPreviewIssues(issues: ScanIssue[]) {
  const deduped = new Map<string, ScanIssue>();

  for (const issue of issues) {
    const key = normalizeIssueKey(issue);
    const existing = deduped.get(key);

    if (!existing) {
      deduped.set(key, issue);
      continue;
    }

    const existingRank = existing.severity === "high" ? 3 : existing.severity === "medium" ? 2 : 1;
    const nextRank = issue.severity === "high" ? 3 : issue.severity === "medium" ? 2 : 1;

    if (nextRank > existingRank) {
      deduped.set(key, issue);
    }
  }

  return Array.from(deduped.values())
    .sort((left, right) => {
      const leftRank = left.severity === "high" ? 3 : left.severity === "medium" ? 2 : 1;
      const rightRank = right.severity === "high" ? 3 : right.severity === "medium" ? 2 : 1;
      return rightRank - leftRank;
    })
    .slice(0, 3)
    .map(toPreviewIssue);
}

function toPreviewPayload(input: {
  sessionId: string;
  url: string;
  label: string;
  scan: PreviewScanPayload;
  createdAt: string;
}): PreviewScanResult {
  const health = buildHealthScore({
    scan: input.scan as ScanResult
  });
  const businessImpact = buildSiteBusinessImpact(input.scan as ScanResult);
  const issueCount = Math.max(1, Math.min(3, buildPreviewIssues(input.scan.issues).length));

  return {
    session_id: input.sessionId,
    normalized_url: input.url,
    website_label: input.label,
    overall_score: health.overall || Math.round(
      (input.scan.performance_score +
        input.scan.seo_score +
        input.scan.accessibility_score +
        input.scan.best_practices_score) / 4
    ),
    scores: {
      performance: input.scan.performance_score,
      seo: input.scan.seo_score,
      accessibility: input.scan.accessibility_score,
      best_practices: input.scan.best_practices_score
    },
    impact_message: businessImpact.headline,
    improvement_message: `Fixing ${issueCount} key issue${issueCount === 1 ? "" : "s"} could improve performance by up to ${businessImpact.improvementPotential}%.`,
    unlock_path: `/unlock-preview/${input.sessionId}`,
    issues: buildPreviewIssues(input.scan.issues),
    generated_at: input.createdAt
  };
}

function computeNextScanAt(frequency: ScanSchedule["frequency"]) {
  const next = new Date();

  if (frequency === "daily") {
    next.setDate(next.getDate() + 1);
  } else if (frequency === "monthly") {
    next.setMonth(next.getMonth() + 1);
  } else {
    next.setDate(next.getDate() + 7);
  }

  return next.toISOString();
}

function nowPlusHours(hours: number) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

async function runPreviewScan(url: string): Promise<PreviewScanPayload> {
  const [pageSpeedResult, accessibilityResult] = await Promise.allSettled([
    runPageSpeedScan(url),
    runAccessibilityScan(url)
  ]);

  if (pageSpeedResult.status === "rejected") {
    throw new Error(pageSpeedResult.reason instanceof Error ? pageSpeedResult.reason.message : "Preview scan failed.");
  }

  const pageSpeed = pageSpeedResult.value;
  const accessibility =
    accessibilityResult.status === "fulfilled"
      ? accessibilityResult.value
      : {
          accessibilityViolations: [] as Array<Record<string, unknown>>,
          issues: [] as ScanIssue[],
          recommendations: [],
          raw: {
            error:
              accessibilityResult.reason instanceof Error
                ? accessibilityResult.reason.message
                : "Accessibility scan failed."
          },
          error: null as string | null
        };

  return {
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
    mobile_snapshot: pageSpeed.mobile_snapshot,
    desktop_snapshot: pageSpeed.desktop_snapshot,
    scan_status: "success",
    error_message: pageSpeed.error_message ?? accessibility.error ?? null
  };
}

function mapSessionRow(row: any): PreviewScanSessionRecord {
  return {
    id: row.id,
    input_url: row.input_url,
    normalized_url: row.normalized_url,
    website_label: row.website_label,
    preview_payload: row.preview_payload,
    scan_payload: row.scan_payload,
    expires_at: row.expires_at,
    claimed_by_user_id: row.claimed_by_user_id,
    claimed_website_id: row.claimed_website_id,
    claimed_scan_id: row.claimed_scan_id,
    created_at: row.created_at
  };
}

export async function createPreviewScanSession(rawUrl: string): Promise<PreviewScanResult> {
  const admin = createSupabaseAdminClient();
  const normalizedUrl = normalizeUrl(rawUrl);
  const nowIso = new Date().toISOString();

  const { data: existingRow } = await admin
    .from("preview_scan_sessions")
    .select("*")
    .eq("normalized_url", normalizedUrl)
    .is("claimed_by_user_id", null)
    .gt("expires_at", nowIso)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingRow) {
    return mapSessionRow(existingRow).preview_payload;
  }

  const label = buildWebsiteLabel(normalizedUrl);
  const scan = await runPreviewScan(normalizedUrl);
  const sessionId = crypto.randomUUID();
  const previewPayload = toPreviewPayload({
    sessionId,
    url: normalizedUrl,
    label,
    scan,
    createdAt: nowIso
  });

  const { error } = await admin.from("preview_scan_sessions").insert({
    id: sessionId,
    input_url: rawUrl,
    normalized_url: normalizedUrl,
    website_label: label,
    preview_payload: previewPayload,
    scan_payload: scan,
    expires_at: nowPlusHours(PREVIEW_SESSION_TTL_HOURS),
    created_at: nowIso
  });

  if (error) {
    throw new Error(error.message);
  }

  return previewPayload;
}

export async function claimPreviewScanSession(input: { sessionId: string; userId: string }) {
  const admin = createSupabaseAdminClient();
  const { data: sessionRow, error: sessionError } = await admin
    .from("preview_scan_sessions")
    .select("*")
    .eq("id", input.sessionId)
    .single();

  if (sessionError || !sessionRow) {
    throw new Error("We couldn't find that preview anymore. Run a fresh scan to unlock the full report.");
  }

  const session = mapSessionRow(sessionRow);

  if (new Date(session.expires_at).getTime() <= Date.now()) {
    throw new Error("This preview expired after 24 hours. Run a fresh free scan to keep going.");
  }

  if (session.claimed_by_user_id && session.claimed_by_user_id !== input.userId) {
    throw new Error("This preview has already been claimed. Run a new scan to unlock your own copy.");
  }

  if (session.claimed_by_user_id === input.userId && session.claimed_website_id) {
    return {
      websiteId: session.claimed_website_id,
      scanId: session.claimed_scan_id
    };
  }

  const { data: profile, error: profileError } = await admin
    .from("users")
    .select("*")
    .eq("id", input.userId)
    .single<UserProfile>();

  if (profileError || !profile) {
    throw new Error("User profile not found.");
  }

  let websiteId: string;
  const { data: existingWebsite } = await admin
    .from("websites")
    .select("*")
    .eq("user_id", input.userId)
    .eq("url", session.normalized_url)
    .maybeSingle<Website>();

  if (existingWebsite) {
    websiteId = existingWebsite.id;
  } else {
    const { count } = await admin
      .from("websites")
      .select("*", { count: "exact", head: true })
      .eq("user_id", input.userId);

    if ((count ?? 0) >= PLAN_LIMITS[profile.plan].websiteLimit) {
      throw new Error(
        `Your ${PLAN_LIMITS[profile.plan].name} plan is full right now. Upgrade or remove a site to unlock this preview.`
      );
    }

    const { data: website, error: websiteError } = await admin
      .from("websites")
      .insert({
        user_id: input.userId,
        url: session.normalized_url,
        label: session.website_label,
        report_frequency: "weekly",
        extra_recipients: [],
        auto_email_reports: true,
        email_notifications: true,
        competitor_urls: []
      })
      .select("*")
      .single<Website>();

    if (websiteError || !website) {
      throw new Error(websiteError?.message ?? "Unable to create the website from this preview.");
    }

    websiteId = website.id;
  }

  const scanPayload = session.scan_payload;
  const scannedAt = new Date().toISOString();
  const { data: scan, error: scanError } = await admin
    .from("scan_results")
    .insert({
      website_id: websiteId,
      performance_score: scanPayload.performance_score,
      seo_score: scanPayload.seo_score,
      accessibility_score: scanPayload.accessibility_score,
      best_practices_score: scanPayload.best_practices_score,
      lcp: scanPayload.lcp,
      fid: scanPayload.fid,
      cls: scanPayload.cls,
      tbt: scanPayload.tbt,
      issues: scanPayload.issues,
      recommendations: scanPayload.recommendations,
      accessibility_violations: scanPayload.accessibility_violations,
      raw_data: scanPayload.raw_data,
      mobile_snapshot: scanPayload.mobile_snapshot ?? {},
      desktop_snapshot: scanPayload.desktop_snapshot ?? {},
      scan_status: scanPayload.scan_status,
      error_message: scanPayload.error_message ?? null,
      scanned_at: scannedAt
    })
    .select("*")
    .single<ScanResult>();

  if (scanError || !scan) {
    throw new Error(scanError?.message ?? "Unable to create a scan from this preview.");
  }

  const defaultFrequency = PLAN_LIMITS[profile.plan].scanFrequencies[0];
  const { data: existingSchedule } = await admin
    .from("scan_schedules")
    .select("*")
    .eq("website_id", websiteId)
    .maybeSingle<ScanSchedule>();

  const schedulePayload = {
    website_id: websiteId,
    frequency: defaultFrequency,
    last_scan_at: scannedAt,
    next_scan_at: computeNextScanAt(defaultFrequency)
  };

  if (existingSchedule?.id) {
    await admin.from("scan_schedules").update(schedulePayload).eq("id", existingSchedule.id);
  } else {
    await admin.from("scan_schedules").insert(schedulePayload);
  }

  await Promise.allSettled([
    ensureSeoAudit({
      websiteId,
      scanId: scan.id,
      url: session.normalized_url,
      suppressExpectedFailure: true
    }),
    ensureSslCheck({
      websiteId,
      url: session.normalized_url
    }),
    ensureSecurityHeadersCheck({
      websiteId,
      url: session.normalized_url
    }),
    ensureCruxData({
      websiteId,
      url: session.normalized_url
    })
  ]);

  await admin
    .from("preview_scan_sessions")
    .update({
      claimed_by_user_id: input.userId,
      claimed_website_id: websiteId,
      claimed_scan_id: scan.id
    })
    .eq("id", session.id);

  return {
    websiteId,
    scanId: scan.id
  };
}
