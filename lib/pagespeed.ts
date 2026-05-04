import type { DeviceAuditSummary, ScanIssue, ScanRecommendation, ScanResult } from "@/types";
import { isPageSpeedRateLimitError } from "@/lib/scan-errors";

const PAGE_SPEED_ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
const AUDIT_DOCS_LINK = "https://developer.chrome.com/docs/lighthouse/overview/";

function parsePositiveInt(raw: string | undefined, fallback: number) {
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const PAGE_SPEED_TIMEOUT_MS = parsePositiveInt(process.env.PAGESPEED_TIMEOUT_MS, 20_000);
const PAGE_SPEED_STRATEGY = "mobile";

let pageSpeedApiKeyCursor = 0;

type PageSpeedAudit = {
  title?: string;
  description?: string;
  score?: number | null;
  scoreDisplayMode?: string;
  displayValue?: string;
  numericValue?: number;
  details?: {
    type?: string;
    overallSavingsMs?: number;
  };
};

type PageSpeedResponse = {
  lighthouseResult?: {
    categories?: Record<string, { score?: number | null }>;
    audits?: Record<string, PageSpeedAudit>;
  };
  loadingExperience?: Record<string, unknown>;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function retryWithBackoff<T>(fn: () => Promise<T>, maxRetries = 2, baseDelayMs = 2000) {
  let attempt = 0;

  while (true) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= maxRetries) {
        throw error;
      }

      const delayMs = Math.round(baseDelayMs * Math.pow(2.5, attempt));
      attempt += 1;
      await sleep(delayMs);
    }
  }
}

function getPageSpeedApiKeys() {
  return [
    process.env.PAGESPEED_API_KEY?.trim(),
    process.env.PAGESPEED_API_KEY_2?.trim(),
    process.env.PAGESPEED_API_KEY_3?.trim()
  ].filter((value): value is string => Boolean(value));
}

function pickPageSpeedApiKey(rotationIndex?: number) {
  const keys = getPageSpeedApiKeys();

  if (!keys.length) {
    return null;
  }

  if (typeof rotationIndex === "number" && Number.isFinite(rotationIndex)) {
    return keys[rotationIndex % keys.length] ?? keys[0];
  }

  const key = keys[pageSpeedApiKeyCursor % keys.length] ?? keys[0];
  pageSpeedApiKeyCursor += 1;
  return key;
}

function toScore(rawScore?: number | null) {
  return Math.round((rawScore ?? 0) * 100);
}

function getSeverityFromScore(score?: number | null): "low" | "medium" | "high" {
  if (score === null || score === undefined) {
    return "low";
  }

  if (score < 0.5) {
    return "high";
  }

  if (score < 0.85) {
    return "medium";
  }

  return "low";
}

function getPriorityFromSavings(savings?: number | null): "low" | "medium" | "high" {
  if (!savings) {
    return "low";
  }

  if (savings >= 1000) {
    return "high";
  }

  if (savings >= 300) {
    return "medium";
  }

  return "low";
}

function extractAuditMetric(
  audits: Record<string, PageSpeedAudit> | undefined,
  key: string,
  fallbackKey?: string
) {
  return audits?.[key]?.numericValue ?? (fallbackKey ? audits?.[fallbackKey]?.numericValue ?? null : null);
}

function parseDeviceSummary(
  response: PageSpeedResponse,
  strategy: "mobile" | "desktop"
): DeviceAuditSummary {
  const categories = response.lighthouseResult?.categories ?? {};
  const audits = response.lighthouseResult?.audits ?? {};

  return {
    strategy,
    performance_score: toScore(categories.performance?.score),
    seo_score: toScore(categories.seo?.score),
    accessibility_score: toScore(categories.accessibility?.score),
    best_practices_score: toScore(categories["best-practices"]?.score),
    lcp: extractAuditMetric(audits, "largest-contentful-paint"),
    fid:
      extractAuditMetric(audits, "max-potential-fid") ??
      extractAuditMetric(audits, "experimental-interaction-to-next-paint"),
    cls: extractAuditMetric(audits, "cumulative-layout-shift"),
    tbt: extractAuditMetric(audits, "total-blocking-time")
  };
}

function extractIssues(
  response: PageSpeedResponse,
  strategy: "mobile" | "desktop"
): ScanIssue[] {
  const audits = response.lighthouseResult?.audits ?? {};

  return Object.entries(audits)
    .filter(([, audit]) => {
      const mode = audit.scoreDisplayMode ?? "binary";
      const score = audit.score;
      if (mode === "notApplicable" || mode === "manual" || mode === "informative") {
        return false;
      }

      return score !== null && score !== undefined && score < 0.9;
    })
    .sort((a, b) => (a[1].score ?? 1) - (b[1].score ?? 1))
    .slice(0, 12)
    .map(([id, audit]) => ({
      id: `${strategy}-${id}`,
      title: audit.title ?? id,
      description: audit.description ?? "An issue affecting this page was detected.",
      severity: getSeverityFromScore(audit.score),
      scoreImpact: audit.score !== undefined && audit.score !== null ? Math.round((1 - audit.score) * 100) : null,
      metric: audit.displayValue ?? null,
      device: strategy
    }));
}

function extractRecommendations(
  response: PageSpeedResponse,
  strategy: "mobile" | "desktop",
  reportUrl: string
): ScanRecommendation[] {
  const audits = response.lighthouseResult?.audits ?? {};

  return Object.entries(audits)
    .filter(([, audit]) => {
      const mode = audit.scoreDisplayMode ?? "";
      const savings = audit.details?.overallSavingsMs ?? audit.numericValue ?? 0;
      return (mode === "metricSavings" || mode === "binary" || mode === "numeric") && savings > 0;
    })
    .sort((a, b) => {
      const leftSavings = a[1].details?.overallSavingsMs ?? a[1].numericValue ?? 0;
      const rightSavings = b[1].details?.overallSavingsMs ?? b[1].numericValue ?? 0;
      return rightSavings - leftSavings;
    })
    .slice(0, 10)
    .map(([id, audit]) => {
      const savings = audit.details?.overallSavingsMs ?? audit.numericValue ?? null;
      return {
        id: `${strategy}-${id}`,
        title: audit.title ?? id,
        description: audit.description ?? "A recommended improvement was identified.",
        priority: getPriorityFromSavings(savings),
        potentialSavingsMs: savings,
        link: reportUrl || AUDIT_DOCS_LINK,
        device: strategy
      };
    });
}

function shortenErrorDetail(message: string) {
  return message.replace(/\s+/g, " ").trim().slice(0, 120) || "unknown response";
}

function classifyPageSpeedError(input: { status?: number; message?: string | null }) {
  const message = input.message?.trim() ?? "";
  const normalized = message.toLowerCase();

  if (input.status === 429 || isPageSpeedRateLimitError(message) || /\brate\b|\bquota\b/.test(normalized)) {
    return "rate-limited: PageSpeed";
  }

  if (
    normalized.includes("aborted") ||
    normalized.includes("timeout") ||
    normalized.includes("timed out")
  ) {
    return "PageSpeed request timed out.";
  }

  if (
    normalized.includes("network") ||
    normalized.includes("fetch failed") ||
    normalized.includes("econnreset") ||
    normalized.includes("econnrefused") ||
    normalized.includes("enotfound")
  ) {
    return "PageSpeed network request failed.";
  }

  return `PageSpeed response parse failed: ${shortenErrorDetail(message || `status ${input.status ?? "unknown"}`)}`;
}

async function fetchStrategyReport(
  url: string,
  strategy: "mobile" | "desktop",
  rotationIndex?: number
) {
  return retryWithBackoff(async () => {
    const params = new URLSearchParams();
    params.set("url", url);
    params.set("strategy", strategy);
    params.append("category", "performance");
    params.append("category", "seo");
    params.append("category", "accessibility");
    params.append("category", "best-practices");
    params.set("fields", "lighthouseResult,loadingExperience");

    const apiKey = pickPageSpeedApiKey(rotationIndex);
    if (apiKey) {
      params.set("key", apiKey);
    }

    console.log("[pagespeed] request url", `${PAGE_SPEED_ENDPOINT}?${params.toString()}`);

    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), PAGE_SPEED_TIMEOUT_MS);

    try {
      const response = await fetch(`${PAGE_SPEED_ENDPOINT}?${params.toString()}`, {
        headers: {
          Accept: "application/json"
        },
        cache: "no-store",
        signal: controller.signal
      });

      if (!response.ok) {
        const contentType = response.headers.get("content-type") ?? "";

        if (contentType.includes("application/json")) {
          const payload = (await response.json().catch(() => null)) as
            | { error?: { message?: string } }
            | null;
          throw new Error(
            classifyPageSpeedError({
              status: response.status,
              message: payload?.error?.message ?? `PageSpeed request failed (${response.status}).`
            })
          );
        }

        const errorText = await response.text();
        throw new Error(
          classifyPageSpeedError({
            status: response.status,
            message: errorText || `PageSpeed request failed (${response.status}).`
          })
        );
      }

      const payload = (await response.json()) as PageSpeedResponse;
      if (!payload.lighthouseResult) {
        throw new Error("Missing lighthouseResult in PageSpeed response.");
      }

      console.log(
        "[pagespeed] lighthouse audit keys",
        Object.keys(payload.lighthouseResult.audits ?? {})
      );

      return payload;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("PageSpeed request timed out.");
      }

      if (error instanceof Error) {
        throw new Error(classifyPageSpeedError({ message: error.message }));
      }

      throw new Error("PageSpeed response parse failed: unknown error");
    } finally {
      clearTimeout(timeoutHandle);
    }
  });
}

export async function runPageSpeedScan(
  url: string,
  options?: {
    rotationIndex?: number;
  }
): Promise<
  Pick<
    ScanResult,
    | "performance_score"
    | "seo_score"
    | "accessibility_score"
    | "best_practices_score"
    | "lcp"
    | "fid"
    | "cls"
    | "tbt"
    | "issues"
    | "recommendations"
    | "raw_data"
    | "mobile_snapshot"
    | "desktop_snapshot"
    | "scan_status"
    | "error_message"
  >
> {
  const reportUrl = `https://pagespeed.web.dev/report?url=${encodeURIComponent(url)}`;
  const mobile = await fetchStrategyReport(url, PAGE_SPEED_STRATEGY, options?.rotationIndex);
  const mobileSummary = parseDeviceSummary(mobile, "mobile");

  return {
    performance_score: mobileSummary.performance_score,
    seo_score: mobileSummary.seo_score,
    accessibility_score: mobileSummary.accessibility_score,
    best_practices_score: mobileSummary.best_practices_score,
    lcp: mobileSummary.lcp,
    fid: mobileSummary.fid,
    cls: mobileSummary.cls,
    tbt: mobileSummary.tbt,
    issues: extractIssues(mobile, "mobile"),
    recommendations: extractRecommendations(mobile, "mobile", reportUrl),
    raw_data: {
      mobile,
      desktop: null,
      scanned_url: url,
      report_url: reportUrl,
      errors: []
    },
    mobile_snapshot: mobileSummary,
    desktop_snapshot: undefined,
    scan_status: "success",
    error_message: null
  };
}
