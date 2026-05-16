import "server-only";

import { buildHealthScore } from "@/lib/health-score";
import { runAccessibilityScan } from "@/lib/pa11y";
import { runPageSpeedScan } from "@/lib/pagespeed";
import { ensureCruxData } from "@/lib/crux";
import { ensureSecurityHeadersCheck } from "@/lib/security-headers-checker";
import { ensureSeoAudit } from "@/lib/seo-audit";
import { getNextScheduledAt } from "@/lib/schedule-monitoring";
import { ensureSslCheck } from "@/lib/ssl-checker";
import { buildSiteBusinessImpact } from "@/lib/business-impact";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  buildLegacyWebsiteNotificationPayload,
  isMissingWebsiteNotificationColumnsError
} from "@/lib/website-notification-compat";
import { resolveWorkspaceContext } from "@/lib/workspace";
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
const SITEPULSE_CANONICAL_HOST = "www.trysitepulse.com";
const SITEPULSE_LEGACY_HOST = "trysitepulse.com";

class PreviewCopyValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PreviewCopyValidationError";
  }
}

function sanitizePreviewText(value: string) {
  return value
    .replace(/`+/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\bLearn more about\.(?=\s|$)/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanText(value: string, maxLength = 130) {
  const cleaned = sanitizePreviewText(value);

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  const shortened = cleaned.slice(0, maxLength);
  const boundary = shortened.search(/\s+\S*$/);
  return (boundary > 32 ? shortened.slice(0, boundary) : shortened).trim();
}

function keepOnlyCompleteSentences(value: string, maxLength: number) {
  const cleaned = sanitizePreviewText(value);

  if (!cleaned) {
    return "";
  }

  const sentences = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .filter((sentence) => /[.!?]$/.test(sentence));

  if (!sentences.length) {
    return "";
  }

  const withinLimit: string[] = [];

  for (const sentence of sentences) {
    const candidate = [...withinLimit, sentence].join(" ").trim();

    if (candidate.length > maxLength) {
      break;
    }

    withinLimit.push(sentence);
  }

  return withinLimit.join(" ").trim();
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

function normalizePreviewUrl(rawUrl: string) {
  const normalizedUrl = normalizeUrl(rawUrl);

  try {
    const parsed = new URL(normalizedUrl);

    if (parsed.hostname.toLowerCase() === SITEPULSE_LEGACY_HOST) {
      parsed.hostname = SITEPULSE_CANONICAL_HOST;
    }

    return parsed.toString();
  } catch {
    return normalizedUrl;
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

function buildIssueFocus(issue: ScanIssue) {
  const title = sanitizePreviewText(issue.title).toLowerCase();
  const description = sanitizePreviewText(issue.description).toLowerCase();
  const source = `${title} ${description}`;

  if (source.includes("speed index")) {
    return "the first useful view arriving too late";
  }

  if (source.includes("javascript execution")) {
    return "too much script work happening before the page feels responsive";
  }

  if (source.includes("largest contentful paint")) {
    return "the main message loading later than visitors expect";
  }

  if (source.includes("redirect")) {
    return "visitors being sent through an extra step before they reach the page";
  }

  if (source.includes("server response")) {
    return "the server taking too long to answer the first request";
  }

  if (source.includes("render blocking")) {
    return "important content waiting behind blocking files";
  }

  if (source.includes("main-thread")) {
    return "the browser doing too much work before the page feels smooth";
  }

  if (source.includes("unused javascript")) {
    return "visitors downloading code they do not need on the first visit";
  }

  if (source.includes("unused css")) {
    return "visitors downloading styling that does not help the first view load faster";
  }

  if (source.includes("cache")) {
    return "returning visitors re-downloading assets that should already feel instant";
  }

  if (source.includes("meta description")) {
    return "search results showing a weaker sales message before the click";
  }

  if (source.includes("title")) {
    return "searchers seeing a less convincing page promise before visiting";
  }

  if (source.includes("canonical")) {
    return "search engines getting mixed signals about which page should rank";
  }

  if (source.includes("robots") || source.includes("sitemap")) {
    return "search engines having a harder time discovering the right pages consistently";
  }

  if (source.includes("schema")) {
    return "search engines missing extra context that supports stronger result visibility";
  }

  if (source.includes("alt")) {
    return "important content losing context for visitors using assistive tools";
  }

  if (source.includes("contrast")) {
    return "key text becoming harder to read when visitors are deciding what to do next";
  }

  if (source.includes("label")) {
    return "forms and controls being less clear than they should be";
  }

  if (source.includes("keyboard")) {
    return "some visitors struggling to move through the page reliably";
  }

  if (source.includes("ssl") || source.includes("https") || source.includes("security")) {
    return "trust signals looking weaker during a critical first impression";
  }

  return `the issue "${cleanText(issue.title, 72).toLowerCase()}" adding avoidable friction`;
}

function buildSpecificImpactSentence(issue: ScanIssue, category: ReturnType<typeof categoryFromIssue>) {
  const focus = buildIssueFocus(issue);

  if (category === "seo") {
    return `Because ${focus}, qualified search traffic is less likely to reach the site or click through with confidence.`;
  }

  if (category === "accessibility") {
    return `Because ${focus}, more visitors face friction completing key actions, which reduces trust and completion rates.`;
  }

  if (category === "security") {
    return `Because ${focus}, the business can look less dependable at the moment visitors decide whether to enquire or share details.`;
  }

  return `Because ${focus}, more visitors leave before they fully see the offer, which pushes bounce rate up and conversions down.`;
}

function buildPreviewCopy(issue: ScanIssue) {
  const category = categoryFromIssue(issue);
  const title = issue.title.toLowerCase();
  const description = issue.description.toLowerCase();

  if (title.includes("speed index")) {
    return {
      summary:
        "The first impression is arriving slower than it should, so visitors wait too long to grasp the offer.",
      why_it_matters:
        "When the page feels slow at the start, more people leave before trust builds or a lead action gets seen."
    };
  }

  if (title.includes("reduce javascript execution time")) {
    return {
      summary:
        "The page feels busier and heavier than it should during the first visit, which makes early interactions feel less smooth.",
      why_it_matters:
        "That friction can reduce clicks, enquiries, and momentum right at the moment a visitor is deciding whether to continue."
    };
  }

  if (title.includes("lcp breakdown")) {
    return {
      summary:
        "The main sales message is taking too long to fully appear, which weakens the site’s opening impression.",
      why_it_matters:
        "If the headline, hero image, or primary value arrives late, visitors are less likely to stay long enough to act."
    };
  }

  if (title.includes("avoid multiple page redirects") || description.includes("redirects introduce additional delays")) {
    return {
      summary:
        "Visitors are taking an extra step before they even reach the real page, which slows down the first impression.",
      why_it_matters:
        "That added delay makes the site feel less polished and increases drop-off before someone sees the offer."
    };
  }

  if (title.includes("reduce initial server response time") || description.includes("server responded slowly")) {
    return {
      summary:
        "The page is taking too long to start responding, which makes the site feel slow before content even begins loading.",
      why_it_matters:
        "When the experience starts with a wait, trust slips early and more visitors abandon before engaging."
    };
  }

  if (title.includes("largest contentful paint image") || title.includes("largest contentful paint element")) {
    return {
      summary:
        "The most important visual part of the page is arriving later than it should, delaying the moment the page feels ready.",
      why_it_matters:
        "If the main content appears late, visitors are less likely to stay confident, keep scrolling, or take the next step."
    };
  }

  if (title.includes("render blocking") || description.includes("requests are blocking the page")) {
    return {
      summary:
        "Important page content is being held back too long, so the site feels slower and less responsive at the start.",
      why_it_matters:
        "That delay hurts first impressions and can reduce how many visitors stay long enough to convert."
    };
  }

  if (title.includes("main-thread work") || title.includes("javascript execution time")) {
    return {
      summary:
        "The page is doing too much work before it feels smooth, which makes the first visit feel heavier than it should.",
      why_it_matters:
        "When early interactions feel sluggish, visitors are more likely to stop exploring before they contact or buy."
    };
  }

  if (title.includes("unused javascript") || title.includes("unused css")) {
    return {
      summary:
        "The page is carrying extra weight that slows down how quickly visitors can get to the important parts.",
      why_it_matters:
        "A heavier experience lowers engagement and makes every campaign click work harder for the same result."
    };
  }

  if (title.includes("uses efficient cache policy") || title.includes("uses long cache ttl")) {
    return {
      summary:
        "Repeat visitors may not be getting the fast return experience they expect, which makes the site feel less efficient over time.",
      why_it_matters:
        "If returning traffic keeps waiting on the same content, engagement drops and paid traffic becomes less efficient."
    };
  }

  const cleanedDescription = keepOnlyCompleteSentences(issue.description, 150);

  if (cleanedDescription && cleanedDescription !== "An issue affecting this page was detected.") {
    return {
      summary: cleanedDescription,
      why_it_matters: buildSpecificImpactSentence(issue, category)
    };
  }

  if (category === "seo") {
    return {
      summary:
        "Search visibility looks weaker than it should be, so high-intent visitors may not be reaching this site consistently.",
      why_it_matters:
        "That usually means fewer qualified visits, fewer enquiries, and less proof of marketing value over time."
    };
  }

  if (category === "accessibility") {
    return {
      summary:
        "Parts of the journey may feel harder to use than they should, which adds friction before a visitor can take action.",
      why_it_matters:
        "When people struggle to read, navigate, or complete simple steps, trust drops and conversion rates usually follow."
    };
  }

  if (category === "security") {
    return {
      summary:
        "Some trust signals appear weaker than they should be, which can make the business feel less dependable at first glance.",
      why_it_matters:
        "Low-confidence experiences make new visitors more cautious about contacting, buying, or sharing their details."
    };
  }

  return {
    summary:
      "This issue is creating extra friction early in the visit, making the site feel slower and less convincing than it should.",
    why_it_matters:
      "Even small delays or hesitations can lower engagement, weaken lead quality, and reduce the return from paid or organic traffic."
  };
}

function toPreviewIssue(issue: ScanIssue): PreviewScanIssue {
  const previewCopy = buildPreviewCopy(issue);

  return {
    id: issue.id,
    title: cleanText(issue.title, 60),
    summary: sanitizePreviewText(previewCopy.summary),
    why_it_matters: sanitizePreviewText(previewCopy.why_it_matters)
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

function validatePreviewIssues(issues: PreviewScanIssue[]) {
  const summaryCounts = new Map<string, number>();
  const impactCounts = new Map<string, number>();

  for (const issue of issues) {
    const normalizedSummary = sanitizePreviewText(issue.summary).toLowerCase();
    const normalizedImpact = sanitizePreviewText(issue.why_it_matters).toLowerCase();

    if (normalizedSummary) {
      summaryCounts.set(normalizedSummary, (summaryCounts.get(normalizedSummary) ?? 0) + 1);
    }

    if (normalizedImpact) {
      impactCounts.set(normalizedImpact, (impactCounts.get(normalizedImpact) ?? 0) + 1);
    }
  }

  const duplicateBody =
    Array.from(summaryCounts.entries()).find(([, count]) => count >= 2) ??
    Array.from(impactCounts.entries()).find(([, count]) => count >= 2);

  if (duplicateBody) {
    throw new PreviewCopyValidationError("Preview generation returned duplicate issue body text.");
  }
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
  const previewIssues = buildPreviewIssues(input.scan.issues);
  validatePreviewIssues(previewIssues);
  const issueCount = Math.max(1, Math.min(3, previewIssues.length));

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
    issues: previewIssues,
    generated_at: input.createdAt
  };
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

function buildPreviewPayloadFromSession(session: PreviewScanSessionRecord) {
  const normalizedUrl = normalizePreviewUrl(session.normalized_url);
  const websiteLabel = buildWebsiteLabel(normalizedUrl);

  return {
    normalizedUrl,
    websiteLabel,
    previewPayload: toPreviewPayload({
      sessionId: session.id,
      url: normalizedUrl,
      label: websiteLabel,
      scan: session.scan_payload,
      createdAt: session.created_at
    })
  };
}

export async function createPreviewScanSession(rawUrl: string): Promise<PreviewScanResult> {
  const admin = createSupabaseAdminClient();
  const normalizedUrl = normalizePreviewUrl(rawUrl);
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
    const existingSession = mapSessionRow(existingRow);
    let refreshed: ReturnType<typeof buildPreviewPayloadFromSession> | null = null;

    try {
      refreshed = buildPreviewPayloadFromSession(existingSession);
    } catch (error) {
      if (!(error instanceof PreviewCopyValidationError)) {
        throw error;
      }
    }

    if (refreshed) {
      if (
        existingSession.normalized_url !== refreshed.normalizedUrl ||
        existingSession.website_label !== refreshed.websiteLabel ||
        JSON.stringify(existingSession.preview_payload) !== JSON.stringify(refreshed.previewPayload)
      ) {
        await admin
          .from("preview_scan_sessions")
          .update({
            normalized_url: refreshed.normalizedUrl,
            website_label: refreshed.websiteLabel,
            preview_payload: refreshed.previewPayload
          })
          .eq("id", existingSession.id);
      }

      return refreshed.previewPayload;
    }
  }

  const label = buildWebsiteLabel(normalizedUrl);
  const sessionId = crypto.randomUUID();
  let previewPayload: PreviewScanResult | null = null;
  let scan: PreviewScanPayload | null = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    scan = await runPreviewScan(normalizedUrl);

    try {
      previewPayload = toPreviewPayload({
        sessionId,
        url: normalizedUrl,
        label,
        scan,
        createdAt: nowIso
      });
      break;
    } catch (error) {
      if (!(error instanceof PreviewCopyValidationError) || attempt === 1) {
        throw error;
      }
    }
  }

  if (!previewPayload || !scan) {
    throw new Error("Unable to build preview scan copy.");
  }

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

  const workspace = await resolveWorkspaceContext(profile);

  let websiteId: string;
  const { data: existingWebsite } = await admin
    .from("websites")
    .select("*")
    .eq("user_id", workspace.workspaceOwnerId)
    .eq("url", session.normalized_url)
    .maybeSingle<Website>();

  if (existingWebsite) {
    websiteId = existingWebsite.id;
  } else {
    const { count } = await admin
      .from("websites")
      .select("*", { count: "exact", head: true })
      .eq("user_id", workspace.workspaceOwnerId);

    if ((count ?? 0) >= PLAN_LIMITS[workspace.workspaceProfile.plan].websiteLimit) {
      throw new Error(
        `Your ${PLAN_LIMITS[workspace.workspaceProfile.plan].name} plan is full right now. Upgrade or remove a site to unlock this preview.`
      );
    }

    let websiteInsertResult = await admin
      .from("websites")
      .insert({
        user_id: workspace.workspaceOwnerId,
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

    if (
      websiteInsertResult.error &&
      isMissingWebsiteNotificationColumnsError(websiteInsertResult.error.message)
    ) {
      websiteInsertResult = await admin
        .from("websites")
        .insert({
          user_id: workspace.workspaceOwnerId,
          url: session.normalized_url,
          label: session.website_label,
          ...buildLegacyWebsiteNotificationPayload({
            reportFrequency: "weekly",
            autoEmailReports: true,
            extraRecipients: []
          }),
          competitor_urls: []
        })
        .select("*")
        .single<Website>();
    }

    const website = websiteInsertResult.data;
    const websiteError = websiteInsertResult.error;

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

  const defaultFrequency = PLAN_LIMITS[workspace.workspaceProfile.plan].scanFrequencies[0];
  const { data: existingSchedule } = await admin
    .from("scan_schedules")
    .select("*")
    .eq("website_id", websiteId)
    .maybeSingle<ScanSchedule>();

  const schedulePayload = {
    website_id: websiteId,
    frequency: defaultFrequency,
    last_scan_at: scannedAt,
    next_scan_at: getNextScheduledAt(defaultFrequency, scannedAt)
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
