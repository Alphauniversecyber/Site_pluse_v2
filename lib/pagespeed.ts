import type { DeviceAuditSummary, ScanIssue, ScanRecommendation, ScanResult } from "@/types";
import { getFriendlyScanFailureMessage, isPageSpeedRateLimitError } from "@/lib/scan-errors";

const PAGE_SPEED_ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
const AUDIT_DOCS_LINK = "https://developer.chrome.com/docs/lighthouse/overview/";
const PAGE_SPEED_TIMEOUT_MS = 90000;

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
};

function average(values: Array<number | null | undefined>) {
  const valid = values.filter((value): value is number => typeof value === "number");
  if (!valid.length) {
    return null;
  }

  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
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
      const aSavings = a[1].details?.overallSavingsMs ?? a[1].numericValue ?? 0;
      const bSavings = b[1].details?.overallSavingsMs ?? b[1].numericValue ?? 0;
      return bSavings - aSavings;
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

async function fetchStrategyReport(url: string, strategy: "mobile" | "desktop") {
  const params = new URLSearchParams();
  params.set("url", url);
  params.set("strategy", strategy);
  params.append("category", "performance");
  params.append("category", "seo");
  params.append("category", "accessibility");
  params.append("category", "best-practices");

  if (process.env.PAGESPEED_API_KEY) {
    params.set("key", process.env.PAGESPEED_API_KEY);
  }

  const response = await fetch(`${PAGE_SPEED_ENDPOINT}?${params.toString()}`, {
    headers: {
      Accept: "application/json"
    },
    cache: "no-store",
    signal: AbortSignal.timeout(PAGE_SPEED_TIMEOUT_MS)
  });

  if (!response.ok) {
    const contentType = response.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: { message?: string } }
        | null;
      const message =
        payload?.error?.message?.trim() || `PageSpeed ${strategy} request failed (${response.status}).`;
      throw new Error(getFriendlyScanFailureMessage(message));
    }

    const errorText = await response.text();
    const rawMessage = isPageSpeedRateLimitError(errorText)
      ? errorText
      : `PageSpeed ${strategy} request failed (${response.status}).`;

    throw new Error(getFriendlyScanFailureMessage(rawMessage));
  }

  return (await response.json()) as PageSpeedResponse;
}

export async function runPageSpeedScan(url: string): Promise<
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
  const uniqueMessages = (messages: string[]) => [...new Set(messages.filter(Boolean))];

  const [mobileResult, desktopResult] = await Promise.allSettled([
    fetchStrategyReport(url, "mobile"),
    fetchStrategyReport(url, "desktop")
  ]);

  if (mobileResult.status === "rejected" && desktopResult.status === "rejected") {
    throw new Error(
      uniqueMessages([
        mobileResult.reason instanceof Error ? mobileResult.reason.message : "Mobile audit failed.",
        desktopResult.reason instanceof Error ? desktopResult.reason.message : "Desktop audit failed."
      ]).join(" | ")
    );
  }

  const reportUrl = `https://pagespeed.web.dev/report?url=${encodeURIComponent(url)}`;
  const mobile = mobileResult.status === "fulfilled" ? mobileResult.value : null;
  const desktop = desktopResult.status === "fulfilled" ? desktopResult.value : null;

  const mobileSummary = mobile ? parseDeviceSummary(mobile, "mobile") : undefined;
  const desktopSummary = desktop ? parseDeviceSummary(desktop, "desktop") : undefined;

  const snapshots = [mobileSummary, desktopSummary].filter(
    (snapshot): snapshot is DeviceAuditSummary => Boolean(snapshot)
  );

  const errorMessages = uniqueMessages(
    [mobileResult, desktopResult]
      .filter((result) => result.status === "rejected")
      .map((result) =>
        getFriendlyScanFailureMessage(result.reason instanceof Error ? result.reason.message : "Unknown PageSpeed error")
      )
  );

  return {
    performance_score: Math.round(average(snapshots.map((snapshot) => snapshot.performance_score)) ?? 0),
    seo_score: Math.round(average(snapshots.map((snapshot) => snapshot.seo_score)) ?? 0),
    accessibility_score: Math.round(average(snapshots.map((snapshot) => snapshot.accessibility_score)) ?? 0),
    best_practices_score: Math.round(average(snapshots.map((snapshot) => snapshot.best_practices_score)) ?? 0),
    lcp: average(snapshots.map((snapshot) => snapshot.lcp)),
    fid: average(snapshots.map((snapshot) => snapshot.fid)),
    cls: average(snapshots.map((snapshot) => snapshot.cls)),
    tbt: average(snapshots.map((snapshot) => snapshot.tbt)),
    issues: [
      ...(mobile ? extractIssues(mobile, "mobile") : []),
      ...(desktop ? extractIssues(desktop, "desktop") : [])
    ],
    recommendations: [
      ...(mobile ? extractRecommendations(mobile, "mobile", reportUrl) : []),
      ...(desktop ? extractRecommendations(desktop, "desktop", reportUrl) : [])
    ],
    raw_data: {
      mobile: mobile ?? null,
      desktop: desktop ?? null,
      scanned_url: url,
      report_url: reportUrl,
      errors: errorMessages
    },
    mobile_snapshot: mobileSummary,
    desktop_snapshot: desktopSummary,
    scan_status: "success",
    error_message: errorMessages.length ? errorMessages.join(" | ") : null
  };
}
