import "server-only";

import { buildCruxSummary, buildHealthScore, buildUptimeSummary } from "@/lib/health-score";
import { buildReportNarrative } from "@/lib/report-ai";
import { renderReportHtml, type ReportContext } from "@/lib/report-template";
import { formatDateTime } from "@/lib/utils";
import type {
  AgencyBranding,
  BrokenLinkRecord,
  CompetitorScanRecord,
  CruxDataRecord,
  ScanResult,
  ScanSchedule,
  SecurityHeadersRecord,
  SeoAuditRecord,
  SslCheckRecord,
  UptimeCheckRecord,
  UserProfile,
  Website
} from "@/types";

type PdfRenderInput = {
  website: Website;
  scan: ScanResult;
  history: ScanResult[];
  previousScan: ScanResult | null;
  branding?: AgencyBranding | null;
  profile: UserProfile;
  schedule?: ScanSchedule | null;
  seoAudit?: SeoAuditRecord | null;
  sslCheck?: SslCheckRecord | null;
  securityHeaders?: SecurityHeadersRecord | null;
  cruxData?: CruxDataRecord | null;
  brokenLinks?: BrokenLinkRecord | null;
  uptimeChecks?: UptimeCheckRecord[];
  competitorScans?: CompetitorScanRecord[];
};

function clampScore(value: number | null | undefined) {
  return Math.max(0, Math.min(100, Math.round(value ?? 0)));
}

function overallScore(scan: ScanResult) {
  return clampScore(
    (scan.performance_score + scan.seo_score + scan.accessibility_score + scan.best_practices_score) / 4
  );
}

function addDays(value: string, days: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function nextReportDate(scan: ScanResult, schedule: ScanSchedule | null | undefined, profile: UserProfile) {
  const frequency = schedule?.frequency ?? profile.email_report_frequency ?? "weekly";
  const days = frequency === "daily" ? 1 : frequency === "monthly" ? 30 : 7;
  return formatDateTime(addDays(scan.scanned_at, days));
}

function statusFromScore(score: number): ReportContext["devices"]["mobile"]["status"] {
  if (score < 50) return "critical";
  if (score < 70) return "needs_attention";
  if (score < 85) return "good";
  return "excellent";
}

function securityStatus(sslCheck?: SslCheckRecord | null): ReportContext["security"]["ssl_status"] {
  if (!sslCheck) return "warning";
  if (!sslCheck.is_valid || sslCheck.grade === "red" || sslCheck.grade === "critical") return "expired";
  if ((sslCheck.days_until_expiry ?? 0) <= 30 || sslCheck.grade === "orange") return "warning";
  return "healthy";
}

function passFail(value: boolean) {
  return value ? "pass" : "fail";
}

function normalizeDifficulty(value: string | null | undefined): "easy" | "medium" | "hard" {
  const normalized = (value ?? "").toLowerCase();
  if (normalized.includes("easy")) return "easy";
  if (normalized.includes("hard") || normalized.includes("complex")) return "hard";
  return "medium";
}

function normalizePriority(value: string | null | undefined): "critical" | "high" | "medium" {
  const normalized = (value ?? "").toLowerCase();
  if (normalized.includes("critical")) return "critical";
  if (normalized.includes("high")) return "high";
  return "medium";
}

function buildIssueList(narrative: Awaited<ReturnType<typeof buildReportNarrative>>) {
  const recommendationMap = new Map(
    narrative.recommendations.map((item) => [item.insight.id, item.ai])
  );

  return narrative.issues
    .map((item) => {
      const recommendation = recommendationMap.get(item.insight.id);
      return {
        priority: normalizePriority(item.ai.priority),
        title: item.ai.title,
        estimated_time: item.insight.timeToFix,
        difficulty: normalizeDifficulty(recommendation?.effort ?? item.insight.difficulty),
        what_is_happening: item.ai.what_is_happening,
        why_it_matters: item.ai.why_it_matters,
        root_cause: item.ai.root_cause,
        how_to_fix: recommendation?.action ?? item.ai.root_cause
      };
    })
    .filter((item) => item.priority !== "medium" || item.title)
    .sort((a, b) => {
      const rank = { critical: 0, high: 1, medium: 2 };
      return rank[a.priority] - rank[b.priority];
    });
}

function buildPriorityActions(
  narrative: Awaited<ReturnType<typeof buildReportNarrative>>,
  issues: ReportContext["issues"]
): ReportContext["plan"]["priority_actions"] {
  const issueById = new Map(issues.map((issue) => [issue.title.toLowerCase(), issue]));
  const actions = narrative.recommendations
    .filter((item) => {
      const priority = normalizePriority(item.ai.priority);
      return priority === "critical" || priority === "high";
    })
    .slice(0, 4)
    .map((item) => ({
      priority: normalizePriority(item.ai.priority) as "critical" | "high",
      difficulty: item.ai.effort,
      time: item.insight.timeToFix,
      title: item.ai.title,
      action: item.ai.action,
      expected_impact: item.ai.expected_impact
    }));

  if (actions.length > 0) {
    return actions;
  }

  return issues.slice(0, 3).map((issue) => ({
    priority: issue.priority === "medium" ? "high" : issue.priority,
    difficulty: issue.difficulty,
    time: issue.estimated_time,
    title: issue.title,
    action: issue.how_to_fix,
    expected_impact: issue.why_it_matters
  }));
}

function parseProjectedRange(value: string | null | undefined, currentScore: number) {
  const match = value?.match(/(\d+)\D+(\d+)/);
  if (match) {
    return {
      min: clampScore(Number(match[1])),
      max: clampScore(Number(match[2]))
    };
  }

  return {
    min: clampScore(currentScore + 5),
    max: clampScore(currentScore + 12)
  };
}

function buildBusinessImpact(
  scan: ScanResult,
  issues: ReportContext["issues"]
): ReportContext["business_impact"] {
  const traffic = `SEO score is ${scan.seo_score}/100. Current search signal gaps reduce how often key pages can rank for non-brand searches.`;
  const conversions = `Performance score is ${scan.performance_score}/100. Speed friction increases abandonment before visitors complete forms, enquiries, or purchases.`;
  const engagement = `Accessibility is ${scan.accessibility_score}/100 and best practices are ${scan.best_practices_score}/100. Usability and trust friction reduce session depth and repeat confidence.`;
  const callout = issues.some((issue) => issue.priority === "critical")
    ? "The highest-value opportunity is to remove the critical blockers first, then use the remaining month to improve speed, trust, and search visibility."
    : "This site is already functional, but the current fixes should improve discoverability, reduce drop-off, and make the experience more credible.";

  return { traffic, conversions, engagement, callout };
}

function buildPlan(
  narrative: Awaited<ReturnType<typeof buildReportNarrative>>,
  currentScore: number,
  priorityActions: ReportContext["plan"]["priority_actions"]
): ReportContext["plan"] {
  const phases = narrative.overview.action_plan.slice(0, 3);
  const fallbackTasks = [{ label: "Review the highest-impact issues and assign fixes", time: "1-2 hours" }];
  const projected = parseProjectedRange(narrative.overview.projected_score_range, currentScore);

  return {
    week1: {
      goal: phases[0]?.focus ?? "Quick wins to remove the most visible friction.",
      tasks: phases[0]?.tasks.map((task) => ({ label: task.task, time: task.time })) ?? fallbackTasks
    },
    week2: {
      goal: phases[1]?.focus ?? "Performance work to reduce load-time and interaction delays.",
      tasks: phases[1]?.tasks.map((task) => ({ label: task.task, time: task.time })) ?? fallbackTasks
    },
    week3_4: {
      goal: phases[2]?.focus ?? "Polish trust, SEO, and accessibility details that affect long-term value.",
      tasks: phases[2]?.tasks.map((task) => ({ label: task.task, time: task.time })) ?? fallbackTasks
    },
    priority_actions: priorityActions,
    current_score: currentScore,
    projected_min: projected.min,
    projected_max: projected.max
  };
}

function buildSeoAuditContext(seoAudit?: SeoAuditRecord | null): ReportContext["seo_audit"] {
  const actionChips: string[] = [];
  const titleLength = seoAudit?.title_tag.length ?? 0;
  const metaLength = seoAudit?.meta_description.length ?? 0;
  const h1Count = seoAudit?.headings.h1_count ?? 0;
  const openGraphComplete = Boolean(
    seoAudit?.og_tags.title && seoAudit?.og_tags.description && seoAudit?.og_tags.image
  );
  const canonicalStatus = seoAudit?.canonical.exists
    ? seoAudit?.canonical.self_referencing
      ? "self_referencing"
      : "not_self_referencing"
    : "missing";

  if (!(titleLength >= 30 && titleLength <= 60)) actionChips.push("Improve title tag");
  if (!(metaLength >= 70 && metaLength <= 160)) actionChips.push("Add a meta description");
  if (h1Count === 0) actionChips.push("Add one main heading");
  if ((seoAudit?.images_missing_alt ?? 0) > 0) actionChips.push("Add alt text to images");
  if (!openGraphComplete) actionChips.push("Add Open Graph tags");
  if (canonicalStatus !== "self_referencing") actionChips.push("Fix canonical tag");

  return {
    title_tag: {
      value: seoAudit?.title_tag.value ?? "",
      chars: titleLength,
      status: titleLength >= 30 && titleLength <= 60 ? "pass" : "fail"
    },
    meta_description: {
      value: seoAudit?.meta_description.value ?? "",
      chars: metaLength,
      status: metaLength >= 70 ? "pass" : "fail"
    },
    heading_structure: {
      h1: h1Count,
      h2: seoAudit?.headings.h2_count ?? 0,
      h3: seoAudit?.headings.h3_count ?? 0,
      status: h1Count > 0 ? "pass" : "fail"
    },
    images_missing_alt: seoAudit?.images_missing_alt ?? 0,
    open_graph: {
      status: seoAudit
        ? openGraphComplete
          ? "complete"
          : "needs_attention"
        : "missing"
    },
    canonical: {
      status: canonicalStatus
    },
    action_chips: actionChips.slice(0, 6)
  };
}

function buildIndustryScore(
  currentScore: number,
  competitorScans?: CompetitorScanRecord[]
) {
  const successful = (competitorScans ?? []).filter((scan) => scan.scan_status === "success");
  if (!successful.length) {
    return Math.min(95, Math.max(55, currentScore - 6));
  }

  const average =
    successful.reduce((sum, scan) => {
      return sum + (scan.performance + scan.seo + scan.accessibility + scan.best_practices) / 4;
    }, 0) / successful.length;

  return clampScore(average);
}

function buildReportContext(
  input: PdfRenderInput,
  narrative: Awaited<ReturnType<typeof buildReportNarrative>>
): ReportContext {
  const score = overallScore(input.scan);
  const securityBreakdown = buildHealthScore({
    scan: input.scan,
    seoAudit: input.seoAudit,
    sslCheck: input.sslCheck,
    securityHeaders: input.securityHeaders,
    uptimeChecks: input.uptimeChecks
  }).breakdown.security;
  const uptimeSummary = buildUptimeSummary(input.uptimeChecks);
  const cruxSummary = buildCruxSummary(input.cruxData);
  const headerCount =
    Number(Boolean(input.securityHeaders?.hsts)) +
    Number(Boolean(input.securityHeaders?.csp)) +
    Number(Boolean(input.securityHeaders?.x_frame_options)) +
    Number(Boolean(input.securityHeaders?.referrer_policy)) +
    Number(Boolean(input.securityHeaders?.permissions_policy)) +
    Number(Boolean(input.securityHeaders?.x_content_type));
  const issues = buildIssueList(narrative);
  const priorityActions = buildPriorityActions(narrative, issues);
  const plan = buildPlan(narrative, score, priorityActions);
  const mobileScore = clampScore(input.scan.mobile_snapshot?.performance_score ?? input.scan.performance_score);
  const desktopScore = clampScore(input.scan.desktop_snapshot?.performance_score ?? input.scan.performance_score);
  const clientName = input.website.label || input.profile.full_name || input.website.url;
  const agencyName = input.branding?.agency_name || "SitePulse";
  const agencyEmail = process.env.FROM_EMAIL ?? input.profile.email;
  const brandColor = input.branding?.brand_color || "#2563EB";
  const monitoringSamples = (input.uptimeChecks ?? []).length;

  return {
    agency_name: agencyName,
    agency_logo_url: input.branding?.logo_url ?? "",
    agency_email: agencyEmail,
    brand_color: brandColor,
    client_name: clientName,
    website_url: input.website.url,
    report_date: formatDateTime(input.scan.scanned_at),
    next_report_date: nextReportDate(input.scan, input.schedule, input.profile),
    health_score: score,
    scores: {
      performance: clampScore(input.scan.performance_score),
      seo: clampScore(input.scan.seo_score),
      accessibility: clampScore(input.scan.accessibility_score),
      best_practices: clampScore(input.scan.best_practices_score)
    },
    deltas: {
      performance: input.previousScan
        ? clampScore(input.scan.performance_score) - clampScore(input.previousScan.performance_score)
        : 0,
      seo: input.previousScan ? clampScore(input.scan.seo_score) - clampScore(input.previousScan.seo_score) : 0,
      accessibility: input.previousScan
        ? clampScore(input.scan.accessibility_score) - clampScore(input.previousScan.accessibility_score)
        : 0,
      best_practices: input.previousScan
        ? clampScore(input.scan.best_practices_score) - clampScore(input.previousScan.best_practices_score)
        : 0,
      is_baseline: !input.previousScan
    },
    industry_score: buildIndustryScore(score, input.competitorScans),
    seo_audit: buildSeoAuditContext(input.seoAudit),
    link_health: {
      total_links: input.brokenLinks?.total_links ?? 0,
      broken_links: input.brokenLinks?.broken_links ?? 0,
      redirect_chains: input.brokenLinks?.redirect_chains ?? 0
    },
    security: {
      ssl_status: securityStatus(input.sslCheck),
      ssl_days_until_expiry: input.sslCheck?.days_until_expiry ?? 0,
      ssl_authority: input.sslCheck?.issuer ?? "Unknown issuer",
      headers_grade: input.securityHeaders?.grade ?? "F",
      headers_present: headerCount,
      health_score: clampScore(securityBreakdown),
      headers: {
        hsts: {
          value: input.securityHeaders?.hsts_value ?? null,
          status: passFail(Boolean(input.securityHeaders?.hsts))
        },
        content_security_policy: {
          value: input.securityHeaders?.csp_value ?? null,
          status: passFail(Boolean(input.securityHeaders?.csp))
        },
        x_frame_options: {
          value: input.securityHeaders?.x_frame_options_value ?? null,
          status: passFail(Boolean(input.securityHeaders?.x_frame_options))
        },
        referrer_policy: {
          value: input.securityHeaders?.referrer_policy_value ?? null,
          status: passFail(Boolean(input.securityHeaders?.referrer_policy))
        },
        permissions_policy: {
          value: input.securityHeaders?.permissions_policy_value ?? null,
          status: passFail(Boolean(input.securityHeaders?.permissions_policy))
        },
        x_content_type_options: {
          value: input.securityHeaders?.x_content_type_value ?? null,
          status: passFail(Boolean(input.securityHeaders?.x_content_type))
        }
      }
    },
    issues,
    business_impact: buildBusinessImpact(input.scan, issues),
    plan,
    vitals: {
      lcp: {
        value: Number((input.scan.lcp ?? 0).toFixed(2)),
        status:
          (input.scan.lcp ?? 0) <= 2.5 ? "good" : (input.scan.lcp ?? 0) <= 4 ? "needs_improvement" : "slow"
      },
      inp: {
        value: clampScore(input.scan.fid ?? input.scan.tbt ?? 0),
        status:
          (input.scan.fid ?? input.scan.tbt ?? 0) <= 200
            ? "good"
            : (input.scan.fid ?? input.scan.tbt ?? 0) <= 500
              ? "needs_improvement"
              : "poor"
      },
      cls: {
        value: Number((input.scan.cls ?? 0).toFixed(4)),
        status:
          (input.scan.cls ?? 0) <= 0.1 ? "good" : (input.scan.cls ?? 0) <= 0.25 ? "needs_improvement" : "poor"
      },
      summary: narrative.overview.vitals_overall
    },
    uptime: {
      status:
        monitoringSamples < 7 || uptimeSummary.percentage === 0 ? "monitoring_active" : "data_available",
      percentage:
        monitoringSamples < 7 || uptimeSummary.percentage === 0 ? null : Number(uptimeSummary.percentage.toFixed(1)),
      incidents: uptimeSummary.incidents.length,
      avg_response_ms: uptimeSummary.averageResponseMs,
      crux_available: Boolean(cruxSummary),
      real_user_speed_pct: cruxSummary ? clampScore(cruxSummary.lcp.good) : null,
      loading_good: cruxSummary ? clampScore(cruxSummary.lcp.good) : null,
      loading_poor: cruxSummary ? clampScore(cruxSummary.lcp.poor) : null,
      stability_good: cruxSummary ? clampScore(cruxSummary.cls.good) : null,
      stability_poor: cruxSummary ? clampScore(cruxSummary.cls.poor) : null,
      interaction_good: cruxSummary ? clampScore(cruxSummary.inp.good) : null,
      interaction_poor: cruxSummary ? clampScore(cruxSummary.inp.poor) : null,
      ttfb_good: cruxSummary ? clampScore(cruxSummary.ttfb.good) : null,
      ttfb_poor: cruxSummary ? clampScore(cruxSummary.ttfb.poor) : null
    },
    devices: {
      mobile: {
        score: mobileScore,
        status: statusFromScore(mobileScore)
      },
      desktop: {
        score: desktopScore,
        status: statusFromScore(desktopScore)
      },
      callout:
        mobileScore + 8 < desktopScore
          ? "Prioritize mobile first. The largest current gap is on smaller screens, where visitor patience is lowest."
          : desktopScore + 8 < mobileScore
            ? "Desktop needs more attention than mobile right now, especially for research-heavy sessions."
            : "Mobile and desktop are performing in a similar range, so focus first on the shared highest-impact fixes."
    }
  };
}

export async function renderAiReportPdf(input: PdfRenderInput): Promise<Buffer> {
  const narrative = await buildReportNarrative({
    website: input.website,
    scan: input.scan,
    previousScan: input.previousScan,
    branding: input.branding ?? null,
    profile: input.profile
  });
  const context = buildReportContext(input, narrative);
  const html = renderReportHtml(context);
  const browser = await getBrowser();

  try {
    const page = await browser.newPage();

    await page.setViewport({ width: 1200, height: 1697, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: "networkidle0" });
    await page.emulateMediaType("screen");

    const pdf = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" }
    });

    await page.close();
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

async function getBrowser() {
  const launchArgs = ["--no-sandbox", "--disable-setuid-sandbox"];
  const useServerlessChromium =
    process.env.VERCEL === "1" ||
    process.env.VERCEL === "true" ||
    Boolean(process.env.AWS_REGION) ||
    process.platform === "linux";

  if (useServerlessChromium) {
    const [{ default: chromium }, { default: puppeteerCore }] = await Promise.all([
      import("@sparticuz/chromium"),
      import("puppeteer-core")
    ]);

    return puppeteerCore.launch({
      headless: true,
      args: [...chromium.args, ...launchArgs],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || (await chromium.executablePath()),
      defaultViewport: {
        width: 1200,
        height: 1697,
        deviceScaleFactor: 2
      }
    });
  }

  const { default: puppeteer } = await import("puppeteer");

  return puppeteer.launch({
    headless: true,
    args: launchArgs,
    defaultViewport: {
      width: 1200,
      height: 1697,
      deviceScaleFactor: 2
    }
  });
}
