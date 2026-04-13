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
import { buildMockGaData } from "@/lib/ga";
import { buildMockGscData } from "@/lib/gsc";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

function hashSeed(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function createRng(seed: string) {
  let state = hashSeed(seed) || 1;

  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let result = Math.imul(state ^ (state >>> 15), 1 | state);
    result ^= result + Math.imul(result ^ (result >>> 7), 61 | result);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

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
  const rng = createRng(`${seed}:health`);
  return Math.round(54 + rng() * 28);
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
  const paths = defaultPaths(website.url);
  const host = hostFromUrl(website.url);

  return [
    {
      id: "mock-meta-descriptions",
      severity: "warning",
      title: "Key pages are missing meta descriptions",
      description: `Search snippets for ${host} are not fully optimized, which can reduce click-through rate from Google.`,
      affectedPages: 4,
      urls: paths.slice(0, 4)
    },
    {
      id: "mock-broken-links",
      severity: "critical",
      title: "Internal links are sending visitors to broken pages",
      description: "A few navigation and footer links are creating dead-end journeys that weaken trust and crawlability.",
      affectedPages: 3,
      urls: [paths[0], paths[1], normalizeUrlPath(website.url, "/resources")]
    },
    {
      id: "mock-alt-text",
      severity: "warning",
      title: "Product and service imagery is missing alt text",
      description: "Important visual content does not include descriptive text, which hurts accessibility and image search context.",
      affectedPages: 5,
      urls: paths.slice(0, 5)
    },
    {
      id: "mock-schema",
      severity: "info",
      title: "Structured data is not implemented on high-intent pages",
      description: "Adding schema can help search engines understand your offers, reviews, and contact details more clearly.",
      affectedPages: 2,
      urls: [paths[0], paths[1]]
    },
    {
      id: "mock-canonicals",
      severity: "warning",
      title: "Canonical tags are inconsistent across landing pages",
      description: "Some marketing pages may be competing with each other because their canonical signals are incomplete.",
      affectedPages: 3,
      urls: [paths[0], paths[4], normalizeUrlPath(website.url, "/landing")]
    },
    {
      id: "mock-headings",
      severity: "info",
      title: "Heading structure needs cleanup on content pages",
      description: "Several pages jump between heading levels, which makes content harder to parse for both users and crawlers.",
      affectedPages: 4,
      urls: [paths[2], paths[4], normalizeUrlPath(website.url, "/blog/seo-tips"), normalizeUrlPath(website.url, "/blog/web-performance")]
    },
    {
      id: "mock-lcp",
      severity: "critical",
      title: "Homepage hero loads too slowly on mobile",
      description: "The largest visible content on the homepage is taking too long to appear, increasing bounce risk from paid and organic traffic.",
      affectedPages: 1,
      urls: [paths[0]]
    },
    {
      id: "mock-sitemap",
      severity: "warning",
      title: "Sitemap coverage is incomplete",
      description: "A few live pages appear to be missing from the sitemap, which can slow discovery and re-crawling.",
      affectedPages: 2,
      urls: [paths[1], normalizeUrlPath(website.url, "/case-studies")]
    },
    {
      id: "mock-internal-links",
      severity: "info",
      title: "Internal linking is weak on conversion-focused pages",
      description: "Important service pages could pass more authority to each other with better contextual internal links.",
      affectedPages: 3,
      urls: [paths[1], normalizeUrlPath(website.url, "/services/seo"), normalizeUrlPath(website.url, "/services/web-design")]
    },
    {
      id: "mock-page-titles",
      severity: "warning",
      title: "Page titles are duplicated across location pages",
      description: "Duplicate title tags make it harder for Google to understand which pages deserve to rank for local intent.",
      affectedPages: 4,
      urls: [
        normalizeUrlPath(website.url, "/locations"),
        normalizeUrlPath(website.url, "/locations/london"),
        normalizeUrlPath(website.url, "/locations/manchester"),
        normalizeUrlPath(website.url, "/locations/birmingham")
      ]
    }
  ] satisfies ClientDashboardIssue[];
}

function buildFallbackRecommendations(website: Website) {
  const host = hostFromUrl(website.url);

  return [
    {
      id: "mock-rec-compress-hero",
      priority: "high",
      title: "Compress and modernize homepage hero media",
      action: "Convert oversized hero images to next-gen formats and preload only the primary image above the fold.",
      impact: `Faster first impressions for ${host}, especially on mobile traffic.`
    },
    {
      id: "mock-rec-fix-links",
      priority: "high",
      title: "Repair broken internal links and add redirects",
      action: "Update dead internal links in the navigation, footer, and resource pages, then add redirects for retired URLs.",
      impact: "Stronger crawl paths and fewer abandoned journeys."
    },
    {
      id: "mock-rec-metadata",
      priority: "high",
      title: "Rewrite metadata for service and location pages",
      action: "Create unique page titles and meta descriptions that reflect search intent and local targeting.",
      impact: "Higher click-through potential from search results."
    },
    {
      id: "mock-rec-schema",
      priority: "medium",
      title: "Add organization, service, and FAQ schema",
      action: "Publish structured data on core commercial pages so search engines understand offerings and trust signals.",
      impact: "Clearer content understanding and better rich-result eligibility."
    },
    {
      id: "mock-rec-sitemap",
      priority: "medium",
      title: "Refresh the sitemap and resubmit key sections",
      action: "Audit the sitemap for missing URLs and ensure core pages are included with correct canonicals.",
      impact: "More reliable discovery for newly updated pages."
    },
    {
      id: "mock-rec-alt",
      priority: "medium",
      title: "Add descriptive alt text to marketing imagery",
      action: "Write concise alt text for service, testimonial, and case-study visuals that convey intent without keyword stuffing.",
      impact: "Improved accessibility and image search context."
    },
    {
      id: "mock-rec-links",
      priority: "low",
      title: "Strengthen contextual internal links",
      action: "Link related service and blog pages together using natural anchor text that helps visitors move deeper into the site.",
      impact: "Better authority flow and more guided browsing paths."
    },
    {
      id: "mock-rec-headings",
      priority: "low",
      title: "Normalize heading order on content templates",
      action: "Standardize H1, H2, and H3 patterns across reusable templates and long-form blog layouts.",
      impact: "Cleaner structure for readers, screen readers, and crawlers."
    }
  ] satisfies ClientDashboardRecommendation[];
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
    return buildFallbackIssues(input.website);
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
    return buildFallbackRecommendations(input.website);
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

  const unique = uniqueById(mapped);
  return unique.length >= 4
    ? unique.slice(0, 8)
    : unique.concat(buildFallbackRecommendations(input.website).slice(0, 8 - unique.length));
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

export async function buildClientDashboardPayload(token: string): Promise<ClientDashboardPayload | null> {
  const website = await getClientByToken(token);

  if (!website) {
    return null;
  }

  const { scan, seoAudit, sslCheck, securityHeaders, brokenLinks, uptimeChecks } = await loadLatestScan(
    website.id
  );

  const healthScore = scan
    ? buildHealthScore({
        scan,
        seoAudit,
        sslCheck,
        securityHeaders,
        uptimeChecks
      }).overall
    : fallbackHealthScore(token);
  const lastUpdated =
    scan?.scanned_at ??
    website.updated_at ??
    website.gsc_connected_at ??
    website.ga_connected_at ??
    website.created_at;

  const gscConnected = Boolean((website.gsc_refresh_token || website.gsc_access_token) && website.gsc_property);
  const gaConnected = Boolean((website.ga_refresh_token || website.ga_access_token) && website.ga_property_id);

  return {
    token,
    clientName: website.label.trim() || hostFromUrl(website.url),
    website: {
      id: website.id,
      url: website.url,
      label: website.label
    },
    lastUpdated,
    healthScore,
    statusLabel: scoreLabel(healthScore),
    connections: {
      gsc: gscConnected,
      ga: gaConnected
    },
    gsc: buildMockGscData({
      seed: token,
      websiteUrl: website.url,
      connected: gscConnected,
      property: website.gsc_property ?? null
    }),
    ga: buildMockGaData({
      seed: token,
      websiteUrl: website.url,
      connected: gaConnected,
      propertyId: website.ga_property_id ?? null
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
    })
  };
}
