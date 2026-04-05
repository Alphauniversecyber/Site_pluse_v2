import type { ScanResult } from "@/types";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function countSeverity(scan: Pick<ScanResult, "issues"> | null | undefined, severity: "high" | "medium" | "low") {
  return (scan?.issues ?? []).filter((issue) => issue.severity === severity).length;
}

export function estimateRevenueLeakPercent(scan: Pick<
  ScanResult,
  "performance_score" | "seo_score" | "accessibility_score" | "best_practices_score" | "issues"
> | null | undefined) {
  if (!scan) {
    return 0;
  }

  const speedPressure = (100 - scan.performance_score) * 0.22;
  const seoPressure = (100 - scan.seo_score) * 0.1;
  const uxPressure = (100 - scan.accessibility_score) * 0.08;
  const trustPressure = (100 - scan.best_practices_score) * 0.05;
  const issuePressure = countSeverity(scan, "high") * 2.2 + countSeverity(scan, "medium") * 1.1;

  return clamp(Math.round(speedPressure + seoPressure + uxPressure + trustPressure + issuePressure), 0, 38);
}

export function estimateImprovementPotential(scan: Pick<
  ScanResult,
  "performance_score" | "seo_score" | "accessibility_score" | "best_practices_score"
> | null | undefined) {
  if (!scan) {
    return 0;
  }

  const projected =
    (100 - scan.performance_score) * 0.28 +
    (100 - scan.seo_score) * 0.12 +
    (100 - scan.accessibility_score) * 0.1 +
    (100 - scan.best_practices_score) * 0.06;

  return clamp(Math.round(projected), 6, 30);
}

export function buildSiteBusinessImpact(scan: Pick<
  ScanResult,
  | "performance_score"
  | "seo_score"
  | "accessibility_score"
  | "best_practices_score"
  | "issues"
  | "lcp"
> | null | undefined) {
  if (!scan) {
    return {
      estimatedLeak: 0,
      improvementPotential: 0,
      headline: "Run the first audit to see where this client site may be losing leads, trust, or conversions.",
      detail: "SitePulse will translate technical issues into business impact so you can explain value quickly."
    };
  }

  const estimatedLeak = estimateRevenueLeakPercent(scan);
  const improvementPotential = estimateImprovementPotential(scan);
  const loadSeconds = scan.lcp ? Number((scan.lcp / 1000).toFixed(1)) : null;

  let driver = "performance and usability issues";
  let detail =
    "Friction on key pages can make visitors hesitate before they enquire, buy, or trust the brand.";

  if (scan.performance_score < 70) {
    driver = "slow load speed and interaction delays";
    detail = loadSeconds
      ? `Pages are loading in about ${loadSeconds}s, which gives visitors more time to drop before they act.`
      : "Slow loading pages give visitors more reasons to leave before they act.";
  } else if (scan.seo_score < 75) {
    driver = "search visibility and technical SEO gaps";
    detail = "Weak search signals make it harder for the right visitors to discover the site consistently.";
  } else if (scan.accessibility_score < 80) {
    driver = "usability and accessibility friction";
    detail = "If visitors struggle to read, navigate, or complete actions, enquiries and conversions fall quietly.";
  } else if (scan.best_practices_score < 80) {
    driver = "trust and experience issues";
    detail = "Trust signals shape whether prospects feel confident enough to keep exploring and convert.";
  }

  return {
    estimatedLeak,
    improvementPotential,
    headline: `This site may be losing ~${estimatedLeak}% of conversions due to ${driver}.`,
    detail
  };
}

export function buildPortfolioImpactSummary(input: {
  urgentSites: number;
  watchSites: number;
  totalSites: number;
  averageHealth: number;
}) {
  if (!input.totalSites) {
    return "Add your first client site to turn audits into a repeatable retention workflow.";
  }

  if (input.urgentSites > 0) {
    return `${input.urgentSites} client site${input.urgentSites === 1 ? " is" : "s are"} at risk right now, so there is immediate retention work to do before the next review.`;
  }

  if (input.watchSites > 0) {
    return `${input.watchSites} client site${input.watchSites === 1 ? " is" : "s are"} in the watch range. Tight follow-up now helps prevent harder conversations later.`;
  }

  return `Your current portfolio health is ${input.averageHealth}/100, which gives your agency a strong proof-of-value story to bring into every client call.`;
}
