import "server-only";

import { Resend, type CreateEmailOptions, type CreateEmailResponse } from "resend";

import type { AgencyBranding, BrokenLinkRecord, ScanResult, SecurityHeadersRecord, Website } from "@/types";
import { formatDateTime, getBaseUrl } from "@/lib/utils";

let resendClient: Resend | null = null;

type EmailLogPayload = Record<string, unknown>;

export type ConfirmedEmailDelivery = {
  provider: "resend";
  messageId: string;
  to: string;
  from: string;
  subject: string;
};

function getResendClient() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("Missing RESEND_API_KEY.");
  }

  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }

  return resendClient;
}

function logEmailEvent(level: "info" | "error" | "warn", event: string, payload: EmailLogPayload) {
  console[level](`[email:${event}]`, payload);
}

function getConfiguredFromEmail(kind: "report" | "alert") {
  const configured =
    (kind === "alert" ? process.env.ALERTS_FROM_EMAIL : undefined) ?? process.env.FROM_EMAIL;

  if (!configured) {
    throw new Error(
      "Missing FROM_EMAIL. Configure a verified sender address in your environment before sending reports."
    );
  }

  if (process.env.NODE_ENV === "production" && configured.toLowerCase().endsWith("@resend.dev")) {
    throw new Error(
      "FROM_EMAIL must use a verified sender domain in production. Update your Resend domain settings and Vercel environment variables."
    );
  }

  return configured;
}

async function sendEmailWithConfirmation(input: {
  kind: "report" | "alert";
  to: string;
  fromName: string;
  subject: string;
  html: string;
  attachments?: CreateEmailOptions["attachments"];
  metadata?: EmailLogPayload;
}) {
  const resend = getResendClient();
  const fromEmail = getConfiguredFromEmail(input.kind);
  const payload: CreateEmailOptions = {
    from: `${input.fromName} <${fromEmail}>`,
    to: input.to,
    subject: input.subject,
    html: input.html,
    attachments: input.attachments
  };

  logEmailEvent("info", "request", {
    kind: input.kind,
    to: input.to,
    from: fromEmail,
    subject: input.subject,
    attachments: input.attachments?.map((attachment) => attachment.filename) ?? [],
    ...input.metadata
  });

  let response: CreateEmailResponse;

  try {
    response = await resend.emails.send(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown email provider error.";

    logEmailEvent("error", "exception", {
      kind: input.kind,
      to: input.to,
      from: fromEmail,
      subject: input.subject,
      error: message,
      ...input.metadata
    });

    throw new Error(`Unable to send email: ${message}`);
  }

  logEmailEvent("info", "response", {
    kind: input.kind,
    to: input.to,
    from: fromEmail,
    subject: input.subject,
    data: response.data,
    error: response.error,
    ...input.metadata
  });

  if (response.error || !response.data?.id) {
    const message =
      response.error?.message ??
      "Email provider did not return a message ID, so delivery could not be confirmed.";

    logEmailEvent("error", "rejected", {
      kind: input.kind,
      to: input.to,
      from: fromEmail,
      subject: input.subject,
      error: message,
      ...input.metadata
    });

    throw new Error(`Unable to send email: ${message}`);
  }

  return {
    provider: "resend" as const,
    messageId: response.data.id,
    to: input.to,
    from: fromEmail,
    subject: input.subject
  };
}

type EmailIssuePriority = "high" | "medium" | "low";
type EmailIssueCategory = "performance" | "seo" | "accessibility" | "security";

type EmailIssueSummary = {
  priority: EmailIssuePriority;
  category: EmailIssueCategory;
  title: string;
  subtitle: string;
  learnMoreUrl: string;
  quickAction: string;
  quickImpact: string;
  difficulty: string;
  effortMinutes: number;
};

function escapeHtml(value: string | number | null | undefined) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatReportDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}

function stripProtocol(url: string) {
  return url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

function getClientWebsiteName(website: Website) {
  return website.label?.trim() || stripProtocol(website.url);
}

function truncateText(value: string, max = 140) {
  if (value.length <= max) {
    return value;
  }

  const cut = value.lastIndexOf(" ", max - 1);
  const shortened = value.slice(0, cut > 0 ? cut : max).trim();
  return `${shortened}. Read more in full report`;
}

function sectionDivider() {
  return `
    <div style="width:80%;height:1px;background:#E2E8F0;margin:0 auto 28px;"></div>
  `;
}

function getScorePalette(score: number) {
  if (score >= 90) {
    return {
      ring: "#10B981",
      text: "#047857",
      background: "#ECFDF5"
    };
  }

  if (score >= 70) {
    return {
      ring: "#F59E0B",
      text: "#B45309",
      background: "#FFFBEB"
    };
  }

  if (score >= 50) {
    return {
      ring: "#F97316",
      text: "#C2410C",
      background: "#FFF7ED"
    };
  }

  return {
    ring: "#DC2626",
    text: "#991B1B",
    background: "#FEF2F2"
  };
}

function getDeltaPresentation(current: number, previous: number | null | undefined) {
  if (previous === null || previous === undefined) {
    return {
      text: "First scan - no comparison yet",
      color: "#94A3B8",
      trendLabel: "Stable"
    };
  }

  const delta = current - previous;

  if (delta > 0) {
    return {
      text: `&uarr; +${delta} from last week`,
      color: "#16A34A",
      trendLabel: "Improving"
    };
  }

  if (delta < 0) {
    return {
      text: `&darr; ${delta} from last week`,
      color: "#DC2626",
      trendLabel: "Declining"
    };
  }

  return {
    text: "&rarr; 0 from last week",
    color: "#64748B",
    trendLabel: "Stable"
  };
}

function getCategoryIcon(category: EmailIssueCategory) {
  if (category === "performance") return "&#9889;";
  if (category === "seo") return "&#128269;";
  if (category === "accessibility") return "&#9855;";
  return "&#128274;";
}

function getPriorityTone(priority: EmailIssuePriority) {
  if (priority === "high") {
    return {
      background: "#FEE2E2",
      border: "#FECACA",
      text: "#991B1B",
      label: "HIGH PRIORITY"
    };
  }

  if (priority === "medium") {
    return {
      background: "#FEF3C7",
      border: "#FDE68A",
      text: "#92400E",
      label: "MEDIUM PRIORITY"
    };
  }

  return {
    background: "#F1F5F9",
    border: "#CBD5E1",
    text: "#475569",
    label: "LOW PRIORITY"
  };
}

function getIssuePriorityValue(priority: EmailIssuePriority) {
  if (priority === "high") return 3;
  if (priority === "medium") return 2;
  return 1;
}

function buildBusinessImpactLines(scan: ScanResult) {
  const lines: Array<{ icon: string; text: string }> = [];

  if (
    scan.performance_score >= 90 &&
    scan.seo_score >= 90 &&
    scan.accessibility_score >= 90 &&
    scan.best_practices_score >= 90
  ) {
    return [
      {
        icon: "&#9989;",
        text: "Your site is performing well across all business-critical areas this week."
      }
    ];
  }

  if (scan.performance_score < 70) {
    lines.push({
      icon: "&#9889;",
      text: "Slow load speed may cause visitors to leave before your page loads - directly reducing leads and conversions."
    });
  }

  if (scan.seo_score < 80) {
    lines.push({
      icon: "&#128269;",
      text: "Lower SEO score means fewer people find your site on Google - reducing organic traffic and new customers."
    });
  }

  if (scan.accessibility_score < 90) {
    lines.push({
      icon: "&#9855;",
      text: "Accessibility issues may prevent some customers from using your site - and can create compliance risk."
    });
  }

  if (scan.best_practices_score < 80) {
    lines.push({
      icon: "&#128274;",
      text: "Best practice gaps may reduce trust signals - affecting checkout confidence and security perception."
    });
  }

  return lines.slice(0, 4);
}

function classifyIssueType(title: string, description: string) {
  const haystack = `${title} ${description}`.toLowerCase();

  if (/broken link|dead link|404|not crawlable/.test(haystack)) {
    return "broken_links";
  }

  if (/security header|content security policy|x-frame|hsts|permissions-policy|x-content-type|referrer-policy|mixed content|ssl|certificate/.test(haystack)) {
    return "security_headers";
  }

  if (/largest contentful paint|lcp|main content/.test(haystack)) {
    return "lcp";
  }

  if (/unused javascript|unused css|unused code|reduce unused/.test(haystack)) {
    return "unused_code";
  }

  if (/cache|caching|cache policy/.test(haystack)) {
    return "caching";
  }

  if (/meta description|title tag|title element|meta descriptions/.test(haystack)) {
    return "seo_meta";
  }

  if (/heading elements|heading order|sequentially-descending|heading structure|h1/.test(haystack)) {
    return "heading_order";
  }

  if (/alt attributes|alt text|missing alt|image elements do not have/.test(haystack)) {
    return "image_alt";
  }

  if (/contrast|aria|label|focus|accessibility/.test(haystack)) {
    return "accessibility_minor";
  }

  if (/render-blocking|server response|main-thread|performance|speed|load/.test(haystack)) {
    return "performance_generic";
  }

  if (/seo|search|crawl|index|discover/.test(haystack)) {
    return "seo_generic";
  }

  return "generic";
}

function mapIssueSummary(raw: { title: string; description: string }, scan: ScanResult): EmailIssueSummary {
  const issueType = classifyIssueType(raw.title, raw.description);

  switch (issueType) {
    case "broken_links":
      return {
        priority: "high",
        category: "seo",
        title: "Broken links are sending visitors to dead ends",
        subtitle:
          "Dead links interrupt journeys and waste paid or organic traffic that should be moving toward an enquiry or sale.",
        learnMoreUrl: "https://developers.google.com/search/docs/crawling-indexing/site-structure",
        quickAction: "Fix or redirect broken links on your highest-traffic pages",
        quickImpact: "Visitors reach the right pages instead of dropping off after a dead click",
        difficulty: "Easy / 30 mins or less",
        effortMinutes: 30
      };
    case "security_headers":
      return {
        priority: "high",
        category: "security",
        title: "Your site is missing key security protections",
        subtitle:
          "Missing security headers weaken trust signals and can make buyers less confident when sharing details or completing a purchase.",
        learnMoreUrl: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers",
        quickAction: "Add the missing security headers in your hosting or server config",
        quickImpact: "Stronger browser trust signals and a cleaner security posture",
        difficulty: "Easy / 1 hour or less",
        effortMinutes: 60
      };
    case "lcp":
      return {
        priority: scan.performance_score < 60 ? "high" : "medium",
        category: "performance",
        title: "Your main content loads slowly",
        subtitle:
          "Visitors judge your site in the first 2 seconds. Faster load times mean more people stay and continue toward action.",
        learnMoreUrl: "https://web.dev/articles/lcp",
        quickAction: "Optimize the page element that takes longest to appear",
        quickImpact: "Faster first impressions and fewer visitors leaving before they engage",
        difficulty: "Easy / 1 hour or less",
        effortMinutes: 60
      };
    case "unused_code":
      return {
        priority: "medium",
        category: "performance",
        title: "Unused code is slowing your site",
        subtitle:
          "Removing unused scripts can make your site load faster — improving visitor experience and conversions.",
        learnMoreUrl: "https://developer.chrome.com/docs/lighthouse/performance/unused-javascript",
        quickAction: "Remove or defer scripts and styles that are not needed on first load",
        quickImpact: "Lean pages load faster, especially on mobile connections",
        difficulty: "Easy / 30 mins or less",
        effortMinutes: 30
      };
    case "caching":
      return {
        priority: "medium",
        category: "performance",
        title: "Repeat visitors are waiting longer than they should",
        subtitle:
          "Better caching helps returning visitors load key pages much faster and reduces unnecessary server work.",
        learnMoreUrl: "https://developer.chrome.com/docs/lighthouse/performance/uses-long-cache-ttl",
        quickAction: "Enable longer cache lifetimes for images, CSS, and JavaScript files",
        quickImpact: "Repeat visits feel much faster and server load drops",
        difficulty: "Easy / 1 hour or less",
        effortMinutes: 60
      };
    case "seo_meta":
      return {
        priority: "medium",
        category: "seo",
        title: "Search engines struggle to understand key pages",
        subtitle:
          "Clear titles and meta descriptions improve how pages appear in search and can increase qualified clicks.",
        learnMoreUrl: "https://developers.google.com/search/docs/fundamentals/seo-starter-guide",
        quickAction: "Write unique page titles and meta descriptions for your key landing pages",
        quickImpact: "Stronger search visibility and better click-through from Google",
        difficulty: "Easy / 30 mins or less",
        effortMinutes: 30
      };
    case "heading_order":
      return {
        priority: "low",
        category: "seo",
        title: "Page structure may confuse search engines",
        subtitle:
          "Proper heading structure helps Google understand your content, which can improve rankings and readability.",
        learnMoreUrl: "https://developers.google.com/search/docs/fundamentals/seo-starter-guide",
        quickAction: "Fix heading order on your most important pages",
        quickImpact: "Cleaner page structure for search engines and assistive tools",
        difficulty: "Easy / 15 mins or less",
        effortMinutes: 15
      };
    case "image_alt":
      return {
        priority: "low",
        category: "accessibility",
        title: "Some images are missing descriptions",
        subtitle:
          "Image descriptions help screen reader users and give search engines extra context about your content.",
        learnMoreUrl: "https://web.dev/learn/accessibility/images",
        quickAction: "Add descriptive alt text to important images",
        quickImpact: "Better accessibility and stronger search context",
        difficulty: "Easy / 15 mins or less",
        effortMinutes: 15
      };
    case "accessibility_minor":
      return {
        priority: "low",
        category: "accessibility",
        title: "Some visitors may struggle to use parts of your site",
        subtitle:
          "Minor accessibility issues still create friction for real people and can lower trust when the experience feels awkward.",
        learnMoreUrl: "https://web.dev/accessibility/",
        quickAction: "Fix minor accessibility warnings on your highest-traffic pages",
        quickImpact: "A smoother experience for more visitors with less friction",
        difficulty: "Easy / 30 mins or less",
        effortMinutes: 30
      };
    case "performance_generic":
      return {
        priority: scan.performance_score < 60 ? "high" : "medium",
        category: "performance",
        title: "Visitors are feeling speed friction",
        subtitle:
          "When pages feel slow, more visitors leave before they see enough value to enquire, book, or buy.",
        learnMoreUrl: "https://developer.chrome.com/docs/lighthouse/performance/",
        quickAction: "Reduce large files and remove load-blocking scripts from the page",
        quickImpact: "Faster page loads and fewer visitors dropping out early",
        difficulty: "Easy / 1 hour or less",
        effortMinutes: 60
      };
    case "seo_generic":
      return {
        priority: "medium",
        category: "seo",
        title: "Important pages need clearer search signals",
        subtitle:
          "Stronger search signals help the right pages rank and bring in more qualified visitors over time.",
        learnMoreUrl: "https://developers.google.com/search/docs/fundamentals/seo-starter-guide",
        quickAction: "Improve on-page search signals on your highest-value pages",
        quickImpact: "More discoverability for pages that support leads and revenue",
        difficulty: "Easy / 30 mins or less",
        effortMinutes: 30
      };
    default:
      return {
        priority: raw.title.toLowerCase().includes("security") ? "high" : "medium",
        category: raw.title.toLowerCase().includes("security") ? "security" : "performance",
        title: "A website issue needs attention this week",
        subtitle:
          "There is a fixable issue affecting how visitors experience your site and how confidently they move toward action.",
        learnMoreUrl: "https://developer.chrome.com/docs/lighthouse/overview/",
        quickAction: "Review this issue and apply the recommended fix in your full report",
        quickImpact: "A cleaner website experience with fewer blockers for visitors",
        difficulty: "Easy / 30 mins or less",
        effortMinutes: 30
      };
  }
}

function buildSupplementalIssues(input: {
  brokenLinks?: BrokenLinkRecord | null;
  securityHeaders?: SecurityHeadersRecord | null;
}) {
  const issues: EmailIssueSummary[] = [];

  if (input.brokenLinks && input.brokenLinks.broken_links > 0) {
    issues.push({
      priority: "high",
      category: "seo",
      title: "Broken links are sending visitors to dead ends",
      subtitle:
        input.brokenLinks.broken_links === 1
          ? "A broken link is currently disrupting at least one visitor path and should be fixed before it wastes more traffic."
          : `${input.brokenLinks.broken_links} broken links are disrupting visitor journeys and sending traffic into dead ends.`,
      learnMoreUrl: "https://developers.google.com/search/docs/crawling-indexing/site-structure",
      quickAction: "Fix or redirect the broken links found in your latest scan",
      quickImpact: "Fewer dead ends and stronger conversion paths across your site",
      difficulty: "Easy / 30 mins or less",
      effortMinutes: 30
    });
  }

  if (input.securityHeaders) {
    const missingCount = [
      input.securityHeaders.hsts,
      input.securityHeaders.csp,
      input.securityHeaders.x_frame_options,
      input.securityHeaders.x_content_type,
      input.securityHeaders.referrer_policy,
      input.securityHeaders.permissions_policy
    ].filter(Boolean).length;

    if (missingCount < 6) {
      issues.push({
        priority: "high",
        category: "security",
        title: "Your site is missing key security protections",
        subtitle:
          `${6 - missingCount} security headers are still missing, which weakens trust signals and browser-level protection.`,
        learnMoreUrl: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers",
        quickAction: "Add the missing security headers in your site configuration",
        quickImpact: "Stronger trust, better protection, and fewer security red flags",
        difficulty: "Easy / 1 hour or less",
        effortMinutes: 60
      });
    }
  }

  return issues;
}

function buildIssueSummaries(input: {
  scan: ScanResult;
  brokenLinks?: BrokenLinkRecord | null;
  securityHeaders?: SecurityHeadersRecord | null;
}) {
  const mapped = input.scan.issues.map((issue) =>
    mapIssueSummary(
      {
        title: issue.title,
        description: issue.description
      },
      input.scan
    )
  );
  const allIssues = [...mapped, ...buildSupplementalIssues(input)];
  const deduped = Array.from(
    new Map(allIssues.map((issue) => [issue.title, issue])).values()
  );

  return deduped.sort((left, right) => {
    const priorityGap = getIssuePriorityValue(right.priority) - getIssuePriorityValue(left.priority);
    if (priorityGap !== 0) {
      return priorityGap;
    }

    return left.effortMinutes - right.effortMinutes;
  });
}

function buildQuickWins(issues: EmailIssueSummary[], scan: ScanResult) {
  const quickWins = [...issues]
    .sort((left, right) => {
      const effortGap = left.effortMinutes - right.effortMinutes;
      if (effortGap !== 0) {
        return effortGap;
      }

      return getIssuePriorityValue(right.priority) - getIssuePriorityValue(left.priority);
    })
    .slice(0, 3);

  const fallbackPool: EmailIssueSummary[] = [];

  if (scan.performance_score < 70) {
    fallbackPool.push({
      priority: "medium",
      category: "performance",
      title: "Visitors are feeling speed friction",
      subtitle:
        "A few straightforward front-end fixes can make the site feel much faster to visitors this week.",
      learnMoreUrl: "https://developer.chrome.com/docs/lighthouse/performance/",
      quickAction: "Compress your homepage images",
      quickImpact: "Faster load time, better SEO visibility, and stronger first impressions",
      difficulty: "Easy / 30 mins or less",
      effortMinutes: 30
    });
  }

  if (scan.seo_score < 80) {
    fallbackPool.push({
      priority: "medium",
      category: "seo",
      title: "Important pages need clearer search signals",
      subtitle:
        "Clear search snippets help more of the right people find and click through to your site.",
      learnMoreUrl: "https://developers.google.com/search/docs/fundamentals/seo-starter-guide",
      quickAction: "Add clear meta descriptions to your key pages",
      quickImpact: "Better search visibility and stronger click-through from Google",
      difficulty: "Easy / 30 mins or less",
      effortMinutes: 30
    });
  }

  if (scan.accessibility_score < 90) {
    fallbackPool.push({
      priority: "low",
      category: "accessibility",
      title: "Small usability wins are still available",
      subtitle:
        "A few housekeeping fixes will improve clarity, trust, and ease of use for more visitors.",
      learnMoreUrl: "https://web.dev/accessibility/",
      quickAction: "Fix heading order on the homepage",
      quickImpact: "Better accessibility and clearer structure for search engines",
      difficulty: "Easy / 15 mins or less",
      effortMinutes: 15
    });
  }

  fallbackPool.push(
    {
      priority: "medium",
      category: "performance",
      title: "Repeat visitors are waiting longer than they should",
      subtitle:
        "Simple caching improvements can speed up repeat visits and reduce server load at the same time.",
      learnMoreUrl: "https://developer.chrome.com/docs/lighthouse/performance/uses-long-cache-ttl",
      quickAction: "Enable browser caching for static assets",
      quickImpact: "Repeat visitors load the site significantly faster",
      difficulty: "Easy / 1 hour or less",
      effortMinutes: 60
    },
    {
      priority: "low",
      category: "accessibility",
      title: "Image descriptions are still missing in places",
      subtitle:
        "Adding short descriptions improves accessibility and gives search engines more context about key visuals.",
      learnMoreUrl: "https://web.dev/learn/accessibility/images",
      quickAction: "Add alt text to key homepage and product images",
      quickImpact: "Better accessibility and stronger image context for search",
      difficulty: "Easy / 30 mins or less",
      effortMinutes: 30
    }
  );

  const seenActions = new Set(quickWins.map((item) => item.quickAction));

  for (const candidate of fallbackPool) {
    if (quickWins.length >= 3) {
      break;
    }

    if (!seenActions.has(candidate.quickAction)) {
      quickWins.push(candidate);
      seenActions.add(candidate.quickAction);
    }
  }

  return quickWins.slice(0, 3);
}

function getCtaConfig(input: { scan: ScanResult; issues: EmailIssueSummary[]; accent: string }) {
  if (input.issues.some((issue) => issue.priority === "high")) {
    return {
      label: "See Your Critical Fixes",
      background: "#DC2626",
      border: "#B91C1C"
    };
  }

  if (input.scan.performance_score < 60) {
    return {
      label: "Get Your Full Optimization Plan",
      background: input.accent,
      border: input.accent
    };
  }

  if (
    input.scan.performance_score >= 80 &&
    input.scan.seo_score >= 80 &&
    input.scan.accessibility_score >= 80 &&
    input.scan.best_practices_score >= 80
  ) {
    return {
      label: "View Your Full Report + What's Next",
      background: input.accent,
      border: input.accent
    };
  }

  return {
    label: "Download Your Full Audit Report",
    background: input.accent,
    border: input.accent
  };
}

function renderScoreSummary(scan: ScanResult, previousScan?: ScanResult | null) {
  const metrics = [
    {
      label: "Performance",
      value: scan.performance_score,
      previous: previousScan?.performance_score ?? null
    },
    {
      label: "SEO",
      value: scan.seo_score,
      previous: previousScan?.seo_score ?? null
    },
    {
      label: "Accessibility",
      value: scan.accessibility_score,
      previous: previousScan?.accessibility_score ?? null
    },
    {
      label: "Best Practices",
      value: scan.best_practices_score,
      previous: previousScan?.best_practices_score ?? null
    }
  ];

  return `
    <div style="border:1px solid #E2E8F0;border-radius:24px;background:#F8FAFC;padding:18px 16px 6px;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
        <tr>
          ${metrics
            .map((metric) => {
              const palette = getScorePalette(metric.value);
              const delta = getDeltaPresentation(metric.value, metric.previous);
              return `
                <td class="metric-cell" style="width:25%;padding:0 8px 12px;vertical-align:top;">
                  <div style="border:1px solid #E2E8F0;border-radius:18px;background:#FFFFFF;padding:16px;min-height:164px;">
                    <div style="font-size:14px;color:#475569;margin-bottom:14px;font-weight:600;">${escapeHtml(metric.label)}</div>
                    <div style="display:flex;align-items:center;gap:12px;">
                      <span style="display:inline-flex;width:58px;height:58px;border-radius:999px;border:5px solid ${palette.ring};align-items:center;justify-content:center;background:${palette.background};font-size:22px;font-weight:700;color:${palette.text};">
                        ${metric.value}
                      </span>
                      <div>
                        <div style="font-size:14px;font-weight:700;color:${delta.color};line-height:1.5;">
                          ${delta.text}
                        </div>
                        <div style="font-size:12px;color:${delta.color};margin-top:4px;">
                          ${escapeHtml(delta.trendLabel)}
                        </div>
                      </div>
                    </div>
                  </div>
                </td>
              `;
            })
            .join("")}
        </tr>
      </table>
    </div>
  `;
}

export async function sendReportEmail(input: {
  to: string;
  website: Website;
  branding?: AgencyBranding | null;
  scan: ScanResult;
  previousScan?: ScanResult | null;
  healthScore?: number | null;
  securityHeaders?: SecurityHeadersRecord | null;
  brokenLinks?: BrokenLinkRecord | null;
  pdfBuffer: Buffer;
  dashboardUrl: string;
}) {
  const baseUrl = getBaseUrl();
  const fromName = input.branding?.email_from_name || input.branding?.agency_name || "SitePulse";
  const accent = input.branding?.brand_color || "#3B82F6";
  const sitePulseLogo = `${baseUrl}/brand/sitepulse-logo-light.svg`;
  const clientWebsiteName = getClientWebsiteName(input.website);
  const websiteHost = stripProtocol(input.website.url);
  const reportDate = formatReportDate(input.scan.scanned_at);
  const performanceDelta =
    input.previousScan !== null && input.previousScan !== undefined
      ? input.scan.performance_score - input.previousScan.performance_score
      : null;
  const issueSummaries = buildIssueSummaries({
    scan: input.scan,
    brokenLinks: input.brokenLinks,
    securityHeaders: input.securityHeaders
  });
  const topIssues = issueSummaries.slice(0, 4);
  const quickWins = buildQuickWins(issueSummaries, input.scan);
  const businessImpactLines = buildBusinessImpactLines(input.scan);
  const cta = getCtaConfig({
    scan: input.scan,
    issues: issueSummaries,
    accent
  });
  const keyIssue = topIssues[0]?.title ?? "your site performance";
  const subject =
    performanceDelta !== null && performanceDelta < 0
      ? `Weekly Report: Performance dropped by ${Math.abs(performanceDelta)} points`
      : performanceDelta !== null && performanceDelta > 0
        ? `Weekly Report: Performance improved by ${performanceDelta} points`
        : `Weekly Website Report for ${clientWebsiteName}`;

  return sendEmailWithConfirmation({
    kind: "report",
    to: input.to,
    fromName,
    subject,
    metadata: {
      websiteId: input.website.id,
      scanId: input.scan.id,
      recipient: input.to
    },
    html: `
      <div style="font-family: Arial, sans-serif; background:#F8FAFC; padding:32px 20px; color:#0F172A;">
        <style>
          @media only screen and (max-width: 600px) {
            .email-shell { width: 100% !important; }
            .content-pad { padding-left: 20px !important; padding-right: 20px !important; }
            .metric-cell { display: block !important; width: 100% !important; padding: 0 0 12px !important; }
            .cta-button { display: block !important; width: 100% !important; }
            .header-meta, .header-identity { display: block !important; width: 100% !important; text-align: left !important; }
          }
        </style>
        <div class="email-shell" style="max-width: 920px; margin: 0 auto; border-radius: 26px; overflow: hidden; border: 1px solid #E2E8F0; background:#FFFFFF; box-shadow: 0 30px 80px -40px rgba(15, 23, 42, 0.45);">
          <div style="background:#0F172A; padding:24px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td class="header-meta" valign="middle">
                  <img src="${sitePulseLogo}" alt="SitePulse" style="max-height:42px; max-width:220px; width:auto; height:auto; object-fit:contain; display:block;" />
                </td>
                <td class="header-identity" valign="middle" style="text-align:right;">
                  <div style="font-size:15px; font-weight:700; color:#F8FAFC;">SitePulse</div>
                  <div style="font-size:13px; color:#CBD5E1; margin-top:4px;">hello@trysitepulse.com</div>
                </td>
              </tr>
            </table>
          </div>

          <div class="content-pad" style="padding:36px 32px 30px;">
            <div style="text-align:center;">
              <h1 style="margin:0; font-size:40px; line-height:1.1; color:#0F172A;">Weekly Website Report for ${escapeHtml(clientWebsiteName)}</h1>
              <p style="margin:12px 0 0; font-size:24px; color:#64748B;">${escapeHtml(websiteHost)}</p>
              <p style="margin:10px 0 0; font-size:12px; color:#94A3B8;">Weekly Performance Report &middot; ${escapeHtml(reportDate)}</p>
            </div>

            <div style="padding-top:26px;">
              <div style="border-radius:22px; border:1px solid #DBEAFE; background:#EFF6FF; padding:18px 20px;">
                <p style="margin:0; font-size:12px; letter-spacing:0.18em; text-transform:uppercase; color:#2563EB; font-weight:700;">Why this matters now</p>
                <p style="margin:10px 0 0; font-size:16px; line-height:1.7; color:#1E293B;">
                  ${performanceDelta !== null && performanceDelta < 0
                    ? `Performance fell by ${Math.abs(performanceDelta)} points since last week, which puts more pressure on conversions and client confidence.`
                    : "This week's scan shows where the site is helping or hurting visibility, speed, and trust."}
                </p>
                <p style="margin:8px 0 0; font-size:16px; line-height:1.7; color:#475569;">
                  The biggest talking point this week is ${escapeHtml(keyIssue.toLowerCase())}. Review the highest-priority fixes below, then open the full report for the complete action plan.
                </p>
              </div>
            </div>

            <div style="padding-top:28px;">
              ${renderScoreSummary(input.scan, input.previousScan)}
            </div>

            <div style="padding-top:28px;">
              <div style="border-radius:22px; border:1px solid #DBEAFE; background:#EFF6FF; padding:18px 20px;">
                <p style="margin:0; font-size:12px; letter-spacing:0.18em; text-transform:uppercase; color:#2563EB; font-weight:700;">What this means for your business</p>
                <div style="margin-top:12px;">
                  ${businessImpactLines
                    .map(
                      (line) => `
                        <div style="display:flex; gap:12px; align-items:flex-start; margin-bottom:12px;">
                          <span style="font-size:18px; line-height:1;">${line.icon}</span>
                          <p style="margin:0; font-size:16px; line-height:1.7; color:#475569;">${escapeHtml(line.text)}</p>
                        </div>
                      `
                    )
                    .join("")}
                </div>
              </div>
            </div>

            <div style="padding-top:28px;">
              ${sectionDivider()}
              <h2 style="margin:0 0 12px; font-size:24px; color:#0F172A;">What needs your attention</h2>
              <p style="margin:0 0 20px; font-size:14px; color:#64748B; line-height:1.7;">Top issues are sorted by priority so you can see what matters most first.</p>
              <div style="border:1px solid #E2E8F0; border-radius:24px; background:#FFFFFF; padding:20px;">
                <h3 style="margin:0 0 18px; font-size:22px; color:#0F172A;">Top issue summary</h3>
                ${
                  topIssues.length
                    ? topIssues
                        .map((issue, index) => {
                          const priority = getPriorityTone(issue.priority);
                          return `
                            <div style="padding:18px 0;${index < topIssues.length - 1 ? "border-bottom:1px solid #E2E8F0;" : ""}">
                              <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:14px; margin-bottom:10px;">
                                <div style="display:flex; gap:10px; align-items:flex-start;">
                                  <span style="font-size:18px; line-height:1;">${getCategoryIcon(issue.category)}</span>
                                  <div style="font-size:18px; font-weight:700; color:#0F172A; line-height:1.45;">${escapeHtml(issue.title)}</div>
                                </div>
                                <span style="display:inline-block; white-space:nowrap; border-radius:999px; border:1px solid ${priority.border}; background:${priority.background}; color:${priority.text}; padding:6px 10px; font-size:11px; font-weight:700; letter-spacing:0.05em;">
                                  ${priority.label}
                                </span>
                              </div>
                              <p style="margin:0; font-size:14px; color:#64748B; line-height:1.7;">
                                ${escapeHtml(truncateText(issue.subtitle, 150))}
                              </p>
                              <div style="margin-top:8px;">
                                <a href="${issue.learnMoreUrl}" style="font-size:13px; color:${accent}; text-decoration:none; font-weight:600;">Learn more &rarr;</a>
                              </div>
                            </div>
                          `;
                        })
                        .join("")
                    : `<div style="padding:8px 0 2px;">
                        <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:14px; margin-bottom:10px;">
                          <div style="display:flex; gap:10px; align-items:flex-start;">
                            <span style="font-size:18px; line-height:1;">&#9989;</span>
                            <div style="font-size:18px; font-weight:700; color:#0F172A; line-height:1.45;">No urgent issues need attention this week</div>
                          </div>
                          <span style="display:inline-block; white-space:nowrap; border-radius:999px; border:1px solid #CBD5E1; background:#F1F5F9; color:#475569; padding:6px 10px; font-size:11px; font-weight:700; letter-spacing:0.05em;">LOW PRIORITY</span>
                        </div>
                        <p style="margin:0; font-size:14px; color:#64748B; line-height:1.7;">This week looks stable overall, so the focus can stay on small improvements and ongoing monitoring.</p>
                      </div>`
                }
              </div>
            </div>

            <div style="padding-top:28px;">
              ${sectionDivider()}
              <div style="border:1px solid #E2E8F0; border-radius:24px; background:#F8FAFC; padding:20px;">
                <h2 style="margin:0 0 16px; font-size:24px; color:#0F172A;">3 quick wins to improve this week</h2>
                ${quickWins
                  .map(
                    (win, index) => `
                      <div style="padding:16px 0;${index < quickWins.length - 1 ? "border-bottom:1px solid #E2E8F0;" : ""}">
                        <div style="display:flex; gap:12px; align-items:flex-start;">
                          <span style="font-size:18px; line-height:1; color:#16A34A;">&#10003;</span>
                          <div>
                            <p style="margin:0; font-size:16px; font-weight:700; color:#0F172A; line-height:1.5;">${escapeHtml(win.quickAction)}</p>
                            <p style="margin:6px 0 0; font-size:14px; color:#475569; line-height:1.7;">Est. impact: ${escapeHtml(win.quickImpact)}</p>
                            <p style="margin:4px 0 0; font-size:14px; color:#64748B; line-height:1.7;">Difficulty: ${escapeHtml(win.difficulty)}</p>
                          </div>
                        </div>
                      </div>
                    `
                  )
                  .join("")}
              </div>
            </div>

            <div style="padding-top:28px;">
              ${sectionDivider()}
              <div style="text-align:center;">
                <a class="cta-button" href="${baseUrl}/dashboard/websites/${input.website.id}" style="display:inline-block; width:100%; max-width:520px; min-height:48px; border-radius:18px; background:${cta.background}; border:1px solid ${cta.border}; color:#FFFFFF; text-decoration:none; padding:16px 24px; font-size:18px; font-weight:700; line-height:1.2;">${escapeHtml(cta.label)} &rarr;</a>
                <p style="margin:10px 0 0; font-size:12px; color:#94A3B8;">Takes 30 seconds &middot; No credit card needed to view</p>
              </div>
            </div>

            <div style="padding-top:28px;">
              ${sectionDivider()}
              <div style="border-radius:24px; border:1px solid #BFDBFE; background:#EFF6FF; padding:24px 22px; text-align:center;">
                <p style="margin:0; font-size:12px; letter-spacing:0.18em; text-transform:uppercase; color:#2563EB; font-weight:700;">📊 Your Live Dashboard</p>
                <p style="margin:14px 0 0; font-size:18px; line-height:1.6; color:#1E293B; font-weight:700;">
                  See your live SEO data anytime &mdash; no login needed.
                </p>
                <div style="margin-top:18px;">
                  <a href="${input.dashboardUrl}" style="display:inline-block; min-width:240px; border-radius:16px; background:#2563EB; color:#FFFFFF; text-decoration:none; padding:14px 22px; font-size:16px; font-weight:700;">
                    View Your Dashboard &rarr;
                  </a>
                </div>
                <p style="margin:14px 0 0; font-size:12px; color:#475569; line-height:1.7;">
                  Link: ${escapeHtml(stripProtocol(input.dashboardUrl))}
                </p>
              </div>
            </div>
          </div>

          <div style="border-top:1px solid #E2E8F0; padding:22px 32px 26px; text-align:center;">
            <p style="margin:0; font-size:14px; color:#64748B; line-height:1.7;">
              This automated report was generated by SitePulse for ${escapeHtml(input.to)}. You&apos;re receiving this because ${escapeHtml(clientWebsiteName)} is in your monitored websites.
            </p>
            <div style="margin-top:14px; font-size:14px; color:#94A3B8; line-height:1.8;">
              <a href="${baseUrl}/dashboard/reports" style="color:${accent}; text-decoration:none;">Manage Reports</a>
              <span style="margin:0 10px; color:#CBD5E1;">&middot;</span>
              <a href="${baseUrl}/dashboard/billing" style="color:${accent}; text-decoration:none;">Billing</a>
              <span style="margin:0 10px; color:#CBD5E1;">&middot;</span>
              <a href="${baseUrl}/dashboard/settings" style="color:${accent}; text-decoration:none;">Unsubscribe</a>
              <span style="margin:0 10px; color:#CBD5E1;">&middot;</span>
              <a href="mailto:hello@trysitepulse.com" style="color:${accent}; text-decoration:none;">Help</a>
            </div>
            <p style="margin:16px 0 0; font-size:12px; color:#94A3B8;">&copy; 2025 SitePulse &middot; hello@trysitepulse.com &middot; Made for agencies, not developers.</p>
          </div>
        </div>
      </div>
    `,
    attachments: [
      {
        filename: `${input.website.label.replace(/\s+/g, "-").toLowerCase()}-report.pdf`,
        content: input.pdfBuffer
      }
    ]
  });
}

export async function sendCriticalAlertEmail(input: {
  to: string;
  website: Website;
  scan: ScanResult;
  reason: string;
  branding?: AgencyBranding | null;
}) {
  const fromName = input.branding?.email_from_name || input.branding?.agency_name || "SitePulse Alerts";
  const subject = `Alert: ${input.website.label} needs attention`;

  return sendEmailWithConfirmation({
    kind: "alert",
    to: input.to,
    fromName,
    subject,
    metadata: {
      websiteId: input.website.id,
      scanId: input.scan.id,
      reason: input.reason
    },
    html: `
      <div style="font-family: Arial, sans-serif; background: #FFF7ED; padding: 32px;">
        <div style="max-width: 680px; margin: 0 auto; background: white; border-radius: 24px; padding: 32px; border: 1px solid #FED7AA;">
          <p style="font-size: 12px; letter-spacing: 0.24em; text-transform: uppercase; color: #C2410C; font-weight: 700;">Urgent client alert</p>
          <h1 style="font-size: 30px; color: #7C2D12; margin-bottom: 12px;">${input.website.label}</h1>
          <p style="font-size: 16px; color: #9A3412; margin-bottom: 20px;">${input.reason}</p>
          <p style="font-size: 16px; color: #334155; margin-bottom: 16px;">Review this quickly so you can explain the issue and next action before the client escalates it.</p>
          <p style="font-size: 16px; color: #334155;">Current performance score: <strong>${input.scan.performance_score}</strong></p>
          <p style="font-size: 16px; color: #334155;">Scan time: ${formatDateTime(input.scan.scanned_at)}</p>
          <a href="${getBaseUrl()}/dashboard/websites/${input.website.id}" style="display: inline-block; margin-top: 20px; background: #C2410C; color: white; text-decoration: none; padding: 14px 20px; border-radius: 999px; font-weight: 700;">
            Review the scan
          </a>
        </div>
      </div>
    `
  });
}

export async function trySendCriticalAlertEmail(input: {
  to: string;
  website: Website;
  scan: ScanResult;
  reason: string;
  branding?: AgencyBranding | null;
}) {
  try {
    return await sendCriticalAlertEmail(input);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown alert delivery error.";

    logEmailEvent("warn", "alert_skipped", {
      to: input.to,
      websiteId: input.website.id,
      scanId: input.scan.id,
      reason: input.reason,
      error: message
    });

    return null;
  }
}
