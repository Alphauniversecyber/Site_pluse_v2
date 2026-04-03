import "server-only";

import type { BrokenLinkRecord } from "@/types";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const BROKEN_LINKS_CACHE_HOURS = 24;
const BROKEN_LINKS_RUN_INTERVAL_DAYS = 7;
const runtimeImport = new Function("specifier", "return import(specifier)") as <T = unknown>(
  specifier: string
) => Promise<T>;

type LinkResultLike = {
  url: string;
  parent?: string | null;
  state: unknown;
  status?: number;
  failureDetails?: unknown[];
};

type RedirectInfoLike = {
  url: string;
  targetUrl?: string | null;
  status: number;
};

function isFresh(timestamp: string, hours: number) {
  return Date.now() - new Date(timestamp).getTime() < hours * 60 * 60 * 1000;
}

function isWithinDays(timestamp: string, days: number) {
  return Date.now() - new Date(timestamp).getTime() < days * 24 * 60 * 60 * 1000;
}

function extractStatus(result: LinkResultLike) {
  if (typeof result.status === "number") {
    return result.status;
  }

  const detail = result.failureDetails?.find(
    (
      item
    ): item is {
      status: number;
    } => typeof item === "object" && item !== null && "status" in item
  );

  return detail?.status ?? 0;
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

  if (!input.force && latest?.scanned_at && isFresh(latest.scanned_at, BROKEN_LINKS_CACHE_HOURS)) {
    return latest;
  }

  if (!input.force && latest?.scanned_at && isWithinDays(latest.scanned_at, BROKEN_LINKS_RUN_INTERVAL_DAYS)) {
    return latest;
  }

  const root = new URL(input.url);
  const { LinkChecker, LinkState } = await runtimeImport<{
    LinkChecker: new () => {
      on(event: "redirect", listener: (details: RedirectInfoLike) => void): void;
      check(input: Record<string, unknown>): Promise<{ links: LinkResultLike[] }>;
    };
    LinkState: {
      BROKEN: unknown;
      OK: unknown;
    };
  }>("linkinator");
  const redirects: RedirectInfoLike[] = [];
  const checker = new LinkChecker();
  checker.on("redirect", (details) => {
    redirects.push(details);
  });

  const result = await checker.check({
    path: input.url,
    recurse: true,
    concurrency: 1,
    timeout: 15000,
    redirects: "warn",
    userAgent: "SitePulse Link Health/1.0",
    linksToSkip: async (link: string) => {
      try {
        const parsed = new URL(link, input.url);
        return parsed.hostname !== root.hostname;
      } catch {
        return true;
      }
    }
  });

  const brokenUrls = result.links
    .filter((link: LinkResultLike) => link.state === LinkState.BROKEN)
    .map((link: LinkResultLike) => ({
      url: link.url,
      parent_url: link.parent ?? null,
      status: extractStatus(link)
    }));

  const payload = {
    website_id: input.websiteId,
    scan_id: input.scanId ?? null,
    total_links: result.links.length,
    working_links: result.links.filter((link: LinkResultLike) => link.state === LinkState.OK).length,
    broken_links: brokenUrls.length,
    redirect_chains: redirects.length,
    broken_urls: brokenUrls,
    redirect_urls: redirects.map((item) => ({
      url: item.url,
      redirected_to: item.targetUrl ?? null,
      status: item.status
    })),
    scanned_at: new Date().toISOString()
  };

  const { data, error } = await admin.from("broken_links").insert(payload).select("*").single();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to store broken link results.");
  }

  return data as BrokenLinkRecord;
}
