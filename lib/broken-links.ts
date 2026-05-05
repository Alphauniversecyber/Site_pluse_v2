import "server-only";

import type { BrokenLinkRecord } from "@/types";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const LINK_SCAN_TIMEOUT_MS = 15_000;
const LINK_SCAN_CONCURRENCY = 20;
const MAX_STORED_BROKEN_URLS = 250;
const MAX_STORED_REDIRECT_URLS = 250;

function normalizeComparableUrl(value: string) {
  try {
    const parsed = new URL(value);
    parsed.hash = "";

    if (parsed.pathname.endsWith("/") && parsed.pathname !== "/") {
      parsed.pathname = parsed.pathname.replace(/\/+$/, "");
    }

    return parsed.toString();
  } catch {
    return value;
  }
}

function normalizeStoredUrl(value?: string | null) {
  if (!value) {
    return null;
  }

  try {
    const parsed = new URL(value);
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return value;
  }
}

async function resolveScanUrl(url: string) {
  try {
    const response = await fetch(url, {
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(LINK_SCAN_TIMEOUT_MS),
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 SitePulseLinkHealth/1.0",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
        "cache-control": "no-cache",
        pragma: "no-cache"
      }
    });

    return response.url || url;
  } catch {
    return url;
  }
}

export async function ensureBrokenLinkCheck(input: {
  websiteId: string;
  url: string;
  scanId?: string | null;
  force?: boolean;
}) {
  const admin = createSupabaseAdminClient();

  const { data: latest } = await admin
    .from("broken_links")
    .select("*")
    .eq("website_id", input.websiteId)
    .order("scanned_at", { ascending: false })
    .limit(1)
    .maybeSingle<BrokenLinkRecord>();

  if (!input.force && latest?.scanned_at) {
    if (!input.scanId || latest.scan_id === input.scanId) {
      return latest;
    }
  }

  const [{ LinkChecker, LinkState }, scanUrl] = await Promise.all([
    import("linkinator"),
    resolveScanUrl(input.url)
  ]);
  const checker = new LinkChecker();
  const redirectTargets = new Map<string, { status: number; redirectedTo: string | null }>();

  checker.on("redirect", (event) => {
    redirectTargets.set(normalizeComparableUrl(event.url), {
      status: event.status,
      redirectedTo: normalizeStoredUrl(event.targetUrl)
    });
  });

  const result = await checker.check({
    path: scanUrl,
    recurse: true,
    concurrency: LINK_SCAN_CONCURRENCY,
    timeout: LINK_SCAN_TIMEOUT_MS,
    redirects: "warn",
    retryErrors: true,
    retryErrorsCount: 2,
    retryErrorsJitter: 1_000,
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 SitePulseLinkHealth/1.0",
    headers: {
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "en-US,en;q=0.9",
      "cache-control": "no-cache",
      pragma: "no-cache"
    }
  });

  const checkedLinks = result.links.filter((link) => {
    if (!link.parent || !/^https?:\/\//i.test(link.url)) {
      return false;
    }

    return link.state !== LinkState.SKIPPED;
  });

  const brokenUrls: BrokenLinkRecord["broken_urls"] = [];
  const redirectUrls: BrokenLinkRecord["redirect_urls"] = [];
  let workingLinks = 0;

  for (const link of checkedLinks) {
    const normalizedUrl = normalizeStoredUrl(link.url);

    if (!normalizedUrl) {
      continue;
    }

    const parentUrl = normalizeStoredUrl(link.parent);
    const redirectMatch = redirectTargets.get(normalizeComparableUrl(link.url));

    if (redirectMatch) {
      redirectUrls.push({
        url: normalizedUrl,
        parent_url: parentUrl,
        status: redirectMatch.status || link.status || 0,
        redirected_to: redirectMatch.redirectedTo
      });
      continue;
    }

    if (link.state === LinkState.BROKEN || !link.status || link.status >= 400) {
      brokenUrls.push({
        url: normalizedUrl,
        parent_url: parentUrl,
        status: link.status ?? 0
      });
      continue;
    }

    workingLinks += 1;
  }

  const payload = {
    website_id: input.websiteId,
    scan_id: input.scanId ?? null,
    total_links: checkedLinks.length,
    working_links: workingLinks,
    broken_links: brokenUrls.length,
    redirect_chains: redirectUrls.length,
    broken_urls: brokenUrls.slice(0, MAX_STORED_BROKEN_URLS),
    redirect_urls: redirectUrls.slice(0, MAX_STORED_REDIRECT_URLS),
    scanned_at: new Date().toISOString()
  };

  const { data, error } = await admin
    .from("broken_links")
    .insert(payload)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to store broken link results.");
  }

  return data as BrokenLinkRecord;
}
