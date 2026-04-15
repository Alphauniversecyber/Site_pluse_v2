import "server-only";

import { load } from "cheerio";

import type { SeoAuditRecord, Severity } from "@/types";
import { logAdminError } from "@/lib/admin/logging";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const SEO_AUDIT_CACHE_HOURS = 24;
const SEO_AUDIT_TIMEOUT_MS = 20_000;
const SEO_AUDIT_FETCH_ATTEMPTS = 3;
const SEO_AUDIT_RETRY_DELAY_MS = 1_500;

function isFresh(timestamp: string, hours: number) {
  return Date.now() - new Date(timestamp).getTime() < hours * 60 * 60 * 1000;
}

function resolveUrl(value: string | undefined | null, baseUrl: string) {
  if (!value) return null;
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return value;
  }
}

function comparableUrl(value: string) {
  const parsed = new URL(value);
  parsed.hash = "";
  if (parsed.pathname.endsWith("/") && parsed.pathname !== "/") {
    parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  }
  return parsed.toString();
}

function titleStatus(length: number, exists: boolean) {
  if (!exists) return "Missing";
  if (length < 50) return "Too short";
  if (length > 60) return "Too long";
  return "Good";
}

function descriptionStatus(length: number, exists: boolean) {
  if (!exists) return "Missing";
  if (length < 150) return "Too short";
  if (length > 160) return "Too long";
  return "Good";
}

function buildSuggestion(title: string, description: string, severity: Severity) {
  return { title, description, severity };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientSeoFetchError(message: string) {
  return /fetch failed|timeout|timed out|network|socket|econn|enotfound|eai_again|tls/i.test(message);
}

function normalizeSeoFetchError(error: Error) {
  if (/fetch failed/i.test(error.message)) {
    return new Error("Unable to fetch the page HTML for SEO audit. The site may be blocking automated requests.");
  }

  return error;
}

async function fetchHtml(url: string) {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= SEO_AUDIT_FETCH_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        cache: "no-store",
        redirect: "follow",
        signal: AbortSignal.timeout(SEO_AUDIT_TIMEOUT_MS),
        headers: {
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 SitePulseSEOAudit/1.0",
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "accept-language": "en-US,en;q=0.9",
          "cache-control": "no-cache",
          pragma: "no-cache"
        }
      });

      if (!response.ok) {
        throw new Error(`SEO audit request failed with status ${response.status}.`);
      }

      return response.text();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("SEO audit fetch failed.");

      if (attempt < SEO_AUDIT_FETCH_ATTEMPTS && isTransientSeoFetchError(lastError.message)) {
        await sleep(SEO_AUDIT_RETRY_DELAY_MS * attempt);
        continue;
      }

      throw normalizeSeoFetchError(lastError);
    }
  }

  throw normalizeSeoFetchError(lastError ?? new Error("SEO audit fetch failed."));
}

function parseSchemaTypes(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).slice(0, 5);
}

export async function ensureSeoAudit(input: {
  websiteId: string;
  scanId: string;
  url: string;
  force?: boolean;
}) {
  const admin = createSupabaseAdminClient();
  try {
    const { data: latest } = await admin
    .from("seo_audit")
    .select("*")
    .eq("website_id", input.websiteId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<SeoAuditRecord>();

  if (!input.force && latest?.created_at && isFresh(latest.created_at, SEO_AUDIT_CACHE_HOURS)) {
    if (latest.scan_id === input.scanId) {
      return latest;
    }
    const clonedPayload = {
      website_id: input.websiteId,
      scan_id: input.scanId,
      title_tag: latest.title_tag,
      meta_description: latest.meta_description,
      headings: latest.headings,
      images_missing_alt: latest.images_missing_alt,
      images_missing_alt_urls: latest.images_missing_alt_urls,
      og_tags: latest.og_tags,
      twitter_tags: latest.twitter_tags,
      canonical: latest.canonical,
      schema_present: latest.schema_present,
      schema_types: latest.schema_types,
      fix_suggestions: latest.fix_suggestions,
      created_at: new Date().toISOString()
    };
    const { data, error } = await admin.from("seo_audit").insert(clonedPayload).select("*").single();
    if (error || !data) throw new Error(error?.message ?? "Unable to clone SEO audit.");
    return data as SeoAuditRecord;
  }

  const html = await fetchHtml(input.url);
  const $ = load(html);

  // metascraper removed — using cheerio only
  const pageTitle = $("title").first().text().trim();
  const metaDescription = ($('meta[name="description"]').attr("content") || "").trim();

  const h1s = $("h1");
  const h2s = $("h2");
  const h3s = $("h3");
  const headingOutline = $("h1, h2, h3")
    .toArray()
    .slice(0, 12)
    .map((element) => ({
      level: element.tagName as "h1" | "h2" | "h3",
      text: $(element).text().replace(/\s+/g, " ").trim()
    }))
    .filter((item) => item.text);

  const imagesMissingAltUrls = $("img")
    .toArray()
    .filter((element) => !($(element).attr("alt") || "").trim())
    .map((element) => resolveUrl($(element).attr("src"), input.url))
    .filter((value): value is string => Boolean(value))
    .slice(0, 5);

  const ogTitle = $('meta[property="og:title"]').attr("content");
  const ogDescription = $('meta[property="og:description"]').attr("content");
  const ogImage = resolveUrl($('meta[property="og:image"]').attr("content"), input.url);
  const twitterCard = $('meta[name="twitter:card"]').attr("content");
  const twitterTitle = $('meta[name="twitter:title"]').attr("content");
  const canonicalHref = resolveUrl($('link[rel="canonical"]').attr("href"), input.url);
  const selfReferencingCanonical = canonicalHref
    ? comparableUrl(canonicalHref) === comparableUrl(input.url)
    : false;

  const schemaTypes = parseSchemaTypes(
    $('script[type="application/ld+json"]')
      .toArray()
      .flatMap((element) => {
        const raw = $(element).html()?.trim();
        if (!raw) return [];
        try {
          const parsed = JSON.parse(raw) as Record<string, unknown> | Array<Record<string, unknown>>;
          const values = Array.isArray(parsed) ? parsed : [parsed];
          return values.flatMap((item) => {
            const typeValue = item?.["@type"];
            return Array.isArray(typeValue)
              ? typeValue.filter((entry): entry is string => typeof entry === "string")
              : typeof typeValue === "string"
                ? [typeValue]
                : [];
          });
        } catch {
          return [];
        }
      })
  );

  const suggestions = [
    !pageTitle
      ? buildSuggestion("Add a page title", "Add a clear title tag so search engines can understand this page.", "high")
      : titleStatus(pageTitle.length, Boolean(pageTitle)) !== "Good"
        ? buildSuggestion("Improve title length", "Keep the title closer to 50 to 60 characters for better search visibility.", "medium")
        : null,
    !metaDescription
      ? buildSuggestion("Add a meta description", "Write a summary that encourages searchers to click through to your page.", "high")
      : descriptionStatus(metaDescription.length, Boolean(metaDescription)) !== "Good"
        ? buildSuggestion("Refine description length", "Aim for roughly 150 to 160 characters so the summary is easier to display in search.", "medium")
        : null,
    h1s.length === 0
      ? buildSuggestion("Add one main heading", "Use a single H1 so the page has one clear primary topic.", "high")
      : h1s.length > 1
        ? buildSuggestion("Reduce multiple H1s", "Keep just one main H1 and move supporting headings into H2s or H3s.", "medium")
        : null,
    imagesMissingAltUrls.length > 0
      ? buildSuggestion("Add alt text to images", "Give important images descriptive alt text to improve accessibility and image SEO.", "medium")
      : null,
    !canonicalHref
      ? buildSuggestion("Add a canonical tag", "Use a canonical link so search engines know which URL should rank.", "medium")
      : !selfReferencingCanonical
        ? buildSuggestion("Fix canonical target", "Point the canonical tag back to this page to avoid confusing search engines.", "medium")
        : null,
    schemaTypes.length === 0
      ? buildSuggestion("Add schema markup", "Structured data can help search engines understand your business and content better.", "low")
      : null
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));

  const payload = {
    website_id: input.websiteId,
    scan_id: input.scanId,
    title_tag: {
      exists: Boolean(pageTitle),
      length: pageTitle.length,
      status: titleStatus(pageTitle.length, Boolean(pageTitle)),
      value: pageTitle || null
    },
    meta_description: {
      exists: Boolean(metaDescription),
      length: metaDescription.length,
      status: descriptionStatus(metaDescription.length, Boolean(metaDescription)),
      value: metaDescription || null
    },
    headings: {
      h1_count: h1s.length,
      h2_count: h2s.length,
      h3_count: h3s.length,
      status:
        h1s.length === 0
          ? "Missing"
          : h1s.length > 1
            ? "Multiple H1s"
            : h3s.length > 0 && h2s.length === 0
              ? "Hierarchy needs review"
              : "Good",
      outline: headingOutline
    },
    images_missing_alt: imagesMissingAltUrls.length,
    images_missing_alt_urls: imagesMissingAltUrls,
    og_tags: {
      title: Boolean(ogTitle),
      description: Boolean(ogDescription),
      image: Boolean(ogImage)
    },
    twitter_tags: {
      card: Boolean(twitterCard),
      title: Boolean(twitterTitle)
    },
    canonical: {
      exists: Boolean(canonicalHref),
      href: canonicalHref,
      self_referencing: selfReferencingCanonical,
      status: !canonicalHref ? "Missing" : selfReferencingCanonical ? "Good" : "Not self-referencing"
    },
    schema_present: schemaTypes.length > 0,
    schema_types: schemaTypes,
    fix_suggestions: suggestions,
    created_at: new Date().toISOString()
  };

  const { data, error } = await admin.from("seo_audit").insert(payload).select("*").single();
  if (error || !data) throw new Error(error?.message ?? "Unable to store SEO audit.");
    return data as SeoAuditRecord;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to run SEO audit.";
    await logAdminError({
      errorType: "seo_audit_failed",
      errorMessage: message,
      websiteId: input.websiteId,
      context: {
        scanId: input.scanId,
        url: input.url
      },
      dedupeWindowMinutes: 30
    });
    throw error;
  }
}
