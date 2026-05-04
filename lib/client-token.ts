import "server-only";

import type {
  BrokenLinkRecord,
  ClientDashboardIssue,
  ClientDashboardPayload,
  ClientDashboardRecommendation,
  ScanIssue,
  ScanRecommendation,
  ScanResult,
  SecurityHeadersRecord,
  SeoAuditRecord,
  SslCheckRecord,
  UptimeCheckRecord,
  Website
} from "@/types";
import { buildHealthScore } from "@/lib/health-score";
import { buildEmptyGaData } from "@/lib/ga";
import { buildEmptyGscData } from "@/lib/gsc";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type SavedClientAiIssue = {
  title: string;
  severity: "critical" | "warning" | "info";
  description: string;
  impact: string;
  category: string;
};

type SavedClientAiRecommendation = {
  title: string;
  priority: "high" | "medium" | "low";
  description: string;
  expectedResult: string;
  effort: "low" | "medium" | "high";
  category: string;
};

type WebsiteWithSavedAi = Website & {
  ai_issues?: SavedClientAiIssue[] | null;
  ai_recommendations?: SavedClientAiRecommendation[] | null;
  ai_issues_generated_at?: string | null;
  ai_recommendations_generated_at?: string | null;
};

type ClientDashboardPayloadWithSavedAi = ClientDashboardPayload & {
  aiIssues: {
    items: SavedClientAiIssue[] | null;
    generatedAt: string | null;
  };
  aiRecommendations: {
    items: SavedClientAiRecommendation[] | null;
    generatedAt: string | null;
  };
};

function stripProtocol(url: string) {
  return url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

function hostFromUrl(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return stripProtocol(url).replace(/^www\./i, "");
  }
}

function normalizeUrlPath(baseUrl: string, path: string) {
  try {
    return new URL(path, baseUrl).toString();
  } catch {
    return `${baseUrl.replace(/\/$/, "")}${path}`;
  }
}

function cleanText(value: string, maxLength = 180) {
  const cleaned = value.replace(/\s+/g, " ").trim();

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  const shortened = cleaned.slice(0, maxLength - 1);
  const boundary = shortened.lastIndexOf(" ");
  return `${shortened.slice(0, boundary > 0 ? boundary : shortened.length)}…`;
}

function normalizeClientPackage(value: string | null | undefined): "growth" | "pro" | "enterprise" {
  if (value === "pro" || value === "enterprise") {
    return value;
  }

  return "growth";
}

function extractAuditValue(rawData: Record<string, unknown> | null | undefined, auditKey: string) {
  const mobile = (rawData?.mobile as
    | { lighthouseResult?: { audits?: Record<string, { numericValue?: number | null }> } }
    | null
    | undefined)?.lighthouseResult?.audits?.[auditKey]?.numericValue;
  const desktop = (rawData?.desktop as
    | { lighthouseResult?: { audits?: Record<string, { numericValue?: number | null }> } }
    | null
    | undefined)?.lighthouseResult?.audits?.[auditKey]?.numericValue;
  const values = [mobile, desktop].filter((value): value is number => typeof value === "number");

  if (!values.length) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildAuditData(scan: ScanResult | null): ClientDashboardPayload["auditData"] {
  if (!scan) {
    return null;
  }

  const fcp = extractAuditValue(scan.raw_data, "first-contentful-paint");
  const tti = extractAuditValue(scan.raw_data, "interactive");
  const speedIndex = extractAuditValue(scan.raw_data, "speed-index");
  const cls = scan.cls ?? null;

  console.log("[client-token] extracted audit values", {
    websiteId: scan.website_id,
    fcp,
    tti,
    speedIndex,
    cls
  });

  return {
    overview: {
      performance: scan.performance_score ?? null,
      seo: scan.seo_score ?? null,
      accessibility: scan.accessibility_score ?? null,
      bestPractices: scan.best_practices_score ?? null,
      lcp: scan.lcp ?? null,
      fcp,
      tbt: scan.tbt ?? null,
      cls,
      tti,
      speedIndex
    },
    issues: scan.issues ?? [],
    recommendations: scan.recommendations ?? [],
    rawData: scan.raw_data ?? {}
  };
}

function scoreLabel(score: number): ClientDashboardPayload["statusLabel"] {
  if (score > 70) {
    return "EXCELLENT";
  }

  if (score >= 40) {
    return "GOOD";
  }

  return "NEEDS ATTENTION";
}

function fallbackHealthScore(seed: string) {
  return seed.length;
}

function defaultPaths(websiteUrl: string) {
  return [
    normalizeUrlPath(websiteUrl, "/"),
    normalizeUrlPath(websiteUrl, "/services"),
    normalizeUrlPath(websiteUrl, "/about"),
    normalizeUrlPath(websiteUrl, "/contact"),
    normalizeUrlPath(websiteUrl, "/blog"),
    normalizeUrlPath(websiteUrl, "/pricing")
  ];
}

function buildFallbackIssues(website: Website) {
  return [] satisfies ClientDashboardIssue[];
}

function buildFallbackRecommendations(website: Website) {
  return [] satisfies ClientDashboardRecommendation[];
}

function severityFromScanIssue(issue: ScanIssue): ClientDashboardIssue["severity"] {
  if (issue.severity === "high") {
    return "critical";
  }

  if (issue.severity === "medium") {
    return "warning";
  }

  return "info";
}

function priorityFromScanRecommendation(
  recommendation: ScanRecommendation
): ClientDashboardRecommendation["priority"] {
  if (recommendation.priority === "high") {
    return "high";
  }

  if (recommendation.priority === "medium") {
    return "medium";
  }

  return "low";
}

function recommendationImpact(title: string, priority: ClientDashboardRecommendation["priority"]) {
  const haystack = title.toLowerCase();

  if (/(meta|title|seo|schema|canonical|sitemap)/.test(haystack)) {
    return "Better search visibility and clearer indexing signals.";
  }

  if (/(image|compress|lazy|script|javascript|css|speed|render)/.test(haystack)) {
    return "Faster page loads and lower abandonment from mobile visitors.";
  }

  if (/(accessibility|alt|contrast|aria|label)/.test(haystack)) {
    return "A smoother experience for more visitors with fewer usability blockers.";
  }

  if (priority === "high") {
    return "A meaningful improvement in performance and conversion confidence.";
  }

  if (priority === "medium") {
    return "A measurable quality improvement across core landing pages.";
  }

  return "Helpful polish that protects long-term SEO health.";
}

function resolveStatusLabel(score: number | null): ClientDashboardPayload["statusLabel"] {
  if (score === null) {
    return "AWAITING REVIEW";
  }

  if (score > 70) {
    return "EXCELLENT";
  }

  if (score >= 40) {
    return "GOOD";
  }

  return "NEEDS ATTENTION";
}

function uniqueById<T extends { id: string }>(values: T[]) {
  const map = new Map<string, T>();

  values.forEach((value) => {
    if (!map.has(value.id)) {
      map.set(value.id, value);
    }
  });

  return Array.from(map.values());
}

function buildIssueUrls(input: {
  website: Website;
  issue: ScanIssue;
  seoAudit: SeoAuditRecord | null;
  brokenLinks: BrokenLinkRecord | null;
}) {
  const title = `${input.issue.title} ${input.issue.description}`.toLowerCase();

  if (/broken|dead link|404/.test(title) && input.brokenLinks?.broken_urls?.length) {
    return input.brokenLinks.broken_urls.slice(0, 5).map((item) => item.url);
  }

  if (/alt|image/.test(title) && input.seoAudit?.images_missing_alt_urls?.length) {
    return input.seoAudit.images_missing_alt_urls.slice(0, 5);
  }

  return [input.website.url];
}

function buildDashboardIssues(input: {
  website: Website;
  scan: ScanResult | null;
  seoAudit: SeoAuditRecord | null;
  securityHeaders: SecurityHeadersRecord | null;
  brokenLinks: BrokenLinkRecord | null;
}) {
  if (!input.scan) {
    return [];
  }

  const mapped = (input.scan.issues ?? []).map((issue) => {
    const urls = buildIssueUrls({
      website: input.website,
      issue,
      seoAudit: input.seoAudit,
      brokenLinks: input.brokenLinks
    });

    return {
      id: issue.id,
      severity: severityFromScanIssue(issue),
      title: cleanText(issue.title, 90),
      description: cleanText(issue.description, 180),
      affectedPages: Math.max(1, urls.length),
      urls
    } satisfies ClientDashboardIssue;
  });

  if (input.brokenLinks && input.brokenLinks.broken_links > 0) {
    mapped.unshift({
      id: "live-broken-links",
      severity: input.brokenLinks.broken_links > 2 ? "critical" : "warning",
      title: "Broken internal links need attention",
      description:
        input.brokenLinks.broken_links > 1
          ? `${input.brokenLinks.broken_links} broken links are interrupting crawl paths and visitor journeys.`
          : "A broken internal link is interrupting at least one visitor journey.",
      affectedPages: input.brokenLinks.broken_links,
      urls: input.brokenLinks.broken_urls.slice(0, 5).map((item) => item.url)
    });
  }

  if (input.securityHeaders && input.securityHeaders.grade !== "A") {
    const missingHeaders = [
      input.securityHeaders.hsts,
      input.securityHeaders.csp,
      input.securityHeaders.x_frame_options,
      input.securityHeaders.x_content_type,
      input.securityHeaders.referrer_policy,
      input.securityHeaders.permissions_policy
    ].filter(Boolean).length;

    mapped.push({
      id: "live-security-headers",
      severity: input.securityHeaders.grade === "F" ? "critical" : "warning",
      title: "Security headers are incomplete",
      description: `${6 - missingHeaders} recommended browser protections are still missing or misconfigured.`,
      affectedPages: 1,
      urls: [input.website.url]
    });
  }

  return uniqueById(mapped).slice(0, 10);
}

function buildDashboardRecommendations(input: {
  website: Website;
  scan: ScanResult | null;
  seoAudit: SeoAuditRecord | null;
  brokenLinks: BrokenLinkRecord | null;
}) {
  if (!input.scan) {
    return [];
  }

  const mapped = (input.scan.recommendations ?? []).map((recommendation) => ({
    id: recommendation.id,
    priority: priorityFromScanRecommendation(recommendation),
    title: cleanText(recommendation.title, 90),
    action: cleanText(recommendation.description, 180),
    impact: recommendationImpact(recommendation.title, priorityFromScanRecommendation(recommendation))
  })) satisfies ClientDashboardRecommendation[];

  if (input.brokenLinks && input.brokenLinks.broken_links > 0) {
    mapped.unshift({
      id: "live-rec-broken-links",
      priority: "high",
      title: "Repair broken internal links",
      action: "Update dead links and add redirects for any URLs that were recently retired or renamed.",
      impact: "Fewer dead ends and stronger page discovery."
    });
  }

  if (input.seoAudit && !input.seoAudit.schema_present) {
    mapped.push({
      id: "live-rec-schema",
      priority: "medium",
      title: "Add schema to core commercial pages",
      action: "Publish organization, service, or FAQ schema where it strengthens understanding for search engines.",
      impact: "More complete search signals and richer search presentation."
    });
  }

  return uniqueById(mapped).slice(0, 8);
}

async function loadLatestScan(websiteId: string) {
  const admin = createSupabaseAdminClient();

  const [
    { data: scan },
    { data: seoAudit },
    { data: sslCheck },
    { data: securityHeaders },
    { data: brokenLinks },
    { data: uptimeChecks }
  ] = await Promise.all([
    admin
      .from("scan_results")
      .select("*")
      .eq("website_id", websiteId)
      .order("scanned_at", { ascending: false })
      .limit(1)
      .maybeSingle<ScanResult>(),
    admin
      .from("seo_audit")
      .select("*")
      .eq("website_id", websiteId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<SeoAuditRecord>(),
    admin
      .from("ssl_checks")
      .select("*")
      .eq("website_id", websiteId)
      .order("checked_at", { ascending: false })
      .limit(1)
      .maybeSingle<SslCheckRecord>(),
    admin
      .from("security_headers")
      .select("*")
      .eq("website_id", websiteId)
      .order("checked_at", { ascending: false })
      .limit(1)
      .maybeSingle<SecurityHeadersRecord>(),
    admin
      .from("broken_links")
      .select("*")
      .eq("website_id", websiteId)
      .order("scanned_at", { ascending: false })
      .limit(1)
      .maybeSingle<BrokenLinkRecord>(),
    admin
      .from("uptime_checks")
      .select("*")
      .eq("website_id", websiteId)
      .order("checked_at", { ascending: false })
      .limit(60)
  ]);

  return {
    scan: scan ?? null,
    seoAudit: seoAudit ?? null,
    sslCheck: sslCheck ?? null,
    securityHeaders: securityHeaders ?? null,
    brokenLinks: brokenLinks ?? null,
    uptimeChecks: (uptimeChecks ?? []) as UptimeCheckRecord[]
  };
}

export async function getClientByToken(token: string) {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("websites")
    .select("*")
    .eq("magic_token", token)
    .maybeSingle<Website>();

  return data ?? null;
}

export async function ensureMagicTokenForWebsite(websiteId: string) {
  const admin = createSupabaseAdminClient();
  const { data: existing } = await admin
    .from("websites")
    .select("magic_token")
    .eq("id", websiteId)
    .maybeSingle<{ magic_token: string | null }>();

  if (existing?.magic_token) {
    return existing.magic_token;
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = crypto.randomUUID();
    const { data, error } = await admin
      .from("websites")
      .update({ magic_token: candidate })
      .eq("id", websiteId)
      .select("magic_token")
      .maybeSingle<{ magic_token: string | null }>();

    if (!error && data?.magic_token) {
      return data.magic_token;
    }
  }

  throw new Error("Unable to create a dashboard token for this website.");
}

export async function saveGSCTokens(
  token: string,
  accessToken: string,
  refreshToken: string | null,
  property: string | null
) {
  const admin = createSupabaseAdminClient();
  const update: Record<string, string | null> = {
    gsc_access_token: accessToken,
    gsc_property: property,
    gsc_connected_at: new Date().toISOString()
  };

  if (refreshToken) {
    update.gsc_refresh_token = refreshToken;
  }

  const { data, error } = await admin
    .from("websites")
    .update(update)
    .eq("magic_token", token)
    .select("*")
    .maybeSingle<Website>();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to save Search Console tokens.");
  }

  return data;
}

export async function saveGATokens(
  token: string,
  accessToken: string,
  refreshToken: string | null,
  propertyId: string | null
) {
  const admin = createSupabaseAdminClient();
  const update: Record<string, string | null> = {
    ga_access_token: accessToken,
    ga_property_id: propertyId,
    ga_connected_at: new Date().toISOString()
  };

  if (refreshToken) {
    update.ga_refresh_token = refreshToken;
  }

  const { data, error } = await admin
    .from("websites")
    .update(update)
    .eq("magic_token", token)
    .select("*")
    .maybeSingle<Website>();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to save GA4 tokens.");
  }

  return data;
}

export async function disconnectClientGoogleService(token: string, service: "gsc" | "ga") {
  const admin = createSupabaseAdminClient();
  const updates =
    service === "gsc"
      ? {
          gsc_access_token: null,
          gsc_refresh_token: null,
          gsc_property: null,
          gsc_connected_at: null
        }
      : {
          ga_access_token: null,
          ga_refresh_token: null,
          ga_property_id: null,
          ga_connected_at: null
        };

  const { data, error } = await admin
    .from("websites")
    .update(updates)
    .eq("magic_token", token)
    .select("*")
    .maybeSingle<Website>();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to disconnect Google service.");
  }

  return data;
}

export async function buildClientDashboardPayload(
  token: string
): Promise<ClientDashboardPayloadWithSavedAi | null> {
  const website = (await getClientByToken(token)) as WebsiteWithSavedAi | null;

  if (!website) {
    return null;
  }

  const { scan, seoAudit, sslCheck, securityHeaders, brokenLinks, uptimeChecks } = await loadLatestScan(
    website.id
  );
  const hasScan = Boolean(scan);
  const healthScore = scan
    ? buildHealthScore({
        scan,
        seoAudit,
        sslCheck,
        securityHeaders,
        uptimeChecks
      }).overall
    : null;
  const lastUpdated =
    scan?.scanned_at ??
    website.updated_at ??
    website.gsc_connected_at ??
    website.ga_connected_at ??
    website.created_at ??
    null;

  const gscConnected = Boolean((website.gsc_refresh_token || website.gsc_access_token) && website.gsc_property);
  const gaConnected = Boolean((website.ga_refresh_token || website.ga_access_token) && website.ga_property_id);
  const clientPackage = normalizeClientPackage(website.package);
  const useCustomDashboardLogo =
    clientPackage !== "growth" && website.client_dashboard_use_branding_logo !== false;
  const brandingAccent = website.branding_color?.trim() || "#3b82f6";
  const clientName = website.label.trim() || hostFromUrl(website.url);

  return {
    token,
    clientName,
    website: {
      id: website.id,
      url: website.url,
      label: website.label
    },
    branding: {
      package: clientPackage,
      useCustomLogo: useCustomDashboardLogo,
      logoUrl:
        !useCustomDashboardLogo
          ? null
          : website.branding_logo?.trim()
            ? website.branding_logo.trim()
            : null,
      accentColor: brandingAccent,
      label:
        !useCustomDashboardLogo
          ? "SitePulse"
          : website.branding_name?.trim()
            ? website.branding_name.trim()
            : null,
      placeholderName:
        website.branding_name?.trim() || clientName
    },
    lastUpdated,
    hasScan,
    healthScore,
    statusLabel: resolveStatusLabel(healthScore),
    connections: {
      gsc: gscConnected,
      ga: gaConnected
    },
    auditData: buildAuditData(scan),
    gsc: buildEmptyGscData({
      connected: gscConnected,
      property: website.gsc_property ?? null,
      source: gscConnected ? "unavailable" : "disconnected"
    }),
    ga: buildEmptyGaData({
      connected: gaConnected,
      propertyId: website.ga_property_id ?? null,
      source: gaConnected ? "unavailable" : "disconnected"
    }),
    issues: buildDashboardIssues({
      website,
      scan,
      seoAudit,
      securityHeaders,
      brokenLinks
    }),
    recommendations: buildDashboardRecommendations({
      website,
      scan,
      seoAudit,
      brokenLinks
    }),
    aiIssues: {
      items: Array.isArray(website.ai_issues) ? website.ai_issues : null,
      generatedAt: website.ai_issues_generated_at ?? null
    },
    aiRecommendations: {
      items: Array.isArray(website.ai_recommendations) ? website.ai_recommendations : null,
      generatedAt: website.ai_recommendations_generated_at ?? null
    }
  };
}
