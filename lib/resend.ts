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

function formatReportMonthYear(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric"
  }).format(new Date(value));
}

function ensureHttpsUrl(url: string) {
  const trimmed = url.trim();

  if (!trimmed) {
    return "";
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/^http:\/\//i, "https://");
  }

  return `https://${trimmed.replace(/^\/+/, "")}`;
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
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
      <tr>
        <td style="padding:0 0 28px 0;border-top:1px solid #E5E7EB;font-size:0;line-height:0;">&nbsp;</td>
      </tr>
    </table>
  `;
}

function buildScoreCircle(score: number, label: string, delta: number | null, isBaseline: boolean): string {
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? "#22C55E" : score >= 50 ? "#F59E0B" : "#EF4444";
  const deltaText = isBaseline
    ? '<span style="color:#9CA3AF;font-size:11px;font-style:italic;line-height:16px;">First scan</span>'
    : delta !== null && delta > 0
      ? `<span style="color:#22C55E;font-size:11px;line-height:16px;">&#9650; ${delta}</span>`
      : delta !== null && delta < 0
        ? `<span style="color:#EF4444;font-size:11px;line-height:16px;">&#9660; ${Math.abs(delta)}</span>`
        : '<span style="color:#9CA3AF;font-size:11px;line-height:16px;">&mdash; stable</span>';

  return `
    <td align="center" valign="top" style="width:25%;padding:8px 6px 0 6px;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
        <tr>
          <td align="center" style="padding:0 0 6px 0;">
            <svg width="80" height="80" viewBox="0 0 80 80" aria-hidden="true">
              <circle cx="40" cy="40" r="${radius}" fill="none" stroke="#E5E7EB" stroke-width="8"/>
              <circle
                cx="40"
                cy="40"
                r="${radius}"
                fill="none"
                stroke="${color}"
                stroke-width="8"
                stroke-dasharray="${circumference.toFixed(1)}"
                stroke-dashoffset="${offset.toFixed(1)}"
                stroke-linecap="round"
                transform="rotate(-90 40 40)"
              />
              <text
                x="40"
                y="47"
                text-anchor="middle"
                font-size="22"
                font-weight="700"
                font-family="Arial, Helvetica, sans-serif"
                fill="#111827"
              >
                ${score}
              </text>
            </svg>
          </td>
        </tr>
        <tr>
          <td align="center" style="font-size:11px;color:#6B7280;text-transform:uppercase;letter-spacing:0.6px;font-weight:700;padding:0 4px;">
            ${escapeHtml(label)}
          </td>
        </tr>
        <tr>
          <td align="center" style="padding-top:4px;">
            ${deltaText}
          </td>
        </tr>
      </table>
    </td>
  `;
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
      label: "HIGH PRIORITY",
      accent: "#EF4444"
    };
  }

  if (priority === "medium") {
    return {
      background: "#FEF3C7",
      border: "#FCD34D",
      text: "#92400E",
      label: "MEDIUM PRIORITY",
      accent: "#F59E0B"
    };
  }

  return {
    background: "#DBEAFE",
    border: "#BFDBFE",
    text: "#1D4ED8",
    label: "LOW PRIORITY",
    accent: "#3B82F6"
  };
}

function getDifficultyTone(effortMinutes: number) {
  if (effortMinutes <= 30) {
    return {
      label: "Easy",
      background: "#DCFCE7",
      border: "#BBF7D0",
      text: "#166534"
    };
  }

  return {
    label: "Medium",
    background: "#FEF3C7",
    border: "#FCD34D",
    text: "#92400E"
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
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;border:1px solid #E5E7EB;background:#FFFFFF;border-radius:8px;">
      <tr>
        <td style="padding:20px 16px 18px 16px;">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr>
              ${metrics
                .map((metric) => {
                  const delta = metric.previous === null ? null : metric.value - metric.previous;
                  return buildScoreCircle(metric.value, metric.label, delta, metric.previous === null);
                })
                .join("")}
            </tr>
          </table>
        </td>
      </tr>
    </table>
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
  const clientWebsiteName = getClientWebsiteName(input.website);
  const websiteHost = stripProtocol(input.website.url);
  const reportDate = formatReportDate(input.scan.scanned_at);
  const reportMonthYear = formatReportMonthYear(input.scan.scanned_at);
  const emailBaseUrl = ensureHttpsUrl(baseUrl).replace(/\/$/, "");
  const websiteUrl = ensureHttpsUrl(input.website.url);
  const manageReportsUrl = `${emailBaseUrl}/dashboard/reports`;
  const billingUrl = `${emailBaseUrl}/dashboard/billing`;
  const unsubscribeUrl = `${emailBaseUrl}/dashboard/settings`;
  const helpUrl = `${emailBaseUrl}/contact`;
  const liveDashboardUrl = ensureHttpsUrl(input.dashboardUrl);
  const dashboardLinkTextRaw = stripProtocol(liveDashboardUrl);
  const dashboardLinkText =
    dashboardLinkTextRaw.length > 44 ? `${dashboardLinkTextRaw.slice(0, 41)}...` : dashboardLinkTextRaw;
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
  const keyIssue = topIssues[0]?.title ?? "your site performance";
  const reportYear = new Date(input.scan.scanned_at).getFullYear();
  const heroSummaryPrimary =
    performanceDelta !== null && performanceDelta < 0
      ? `Performance fell by ${Math.abs(performanceDelta)} points since last week, which puts more pressure on conversions and client confidence.`
      : "This week's scan shows where the site is helping or hurting visibility, speed, and trust.";
  const heroSummarySecondary = `The biggest talking point this week is ${keyIssue.toLowerCase()}. Review the highest-priority fixes below, then open the full report for the complete action plan.`;
  const businessImpactMarkup = businessImpactLines
    .map(
      (line) => `
        <tr>
          <td valign="top" style="width:28px;padding:0 12px 12px 0;font-size:16px;line-height:20px;">${line.icon}</td>
          <td valign="top" style="padding:0 0 12px 0;font-size:14px;line-height:22px;color:#4B5563;">
            ${escapeHtml(line.text)}
          </td>
        </tr>
      `
    )
    .join("");
  const issuesMarkup = topIssues.length
    ? topIssues
        .map((issue, index) => {
          const priority = getPriorityTone(issue.priority);

          return `
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td style="padding:0 0 ${index < topIssues.length - 1 ? 12 : 0}px 0;">
                  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;border:1px solid #E5E7EB;border-left:4px solid ${priority.accent};border-radius:8px;background:#FFFFFF;box-shadow:0 6px 18px rgba(15,23,42,0.06);">
                    <tr>
                      <td style="padding:18px 18px 16px 18px;">
                        <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                          <tr>
                            <td valign="top" style="padding:0 12px 10px 0;">
                              <table cellpadding="0" cellspacing="0" role="presentation">
                                <tr>
                                  <td valign="top" style="padding:1px 10px 0 0;font-size:16px;line-height:20px;color:#6B7280;">${getCategoryIcon(issue.category)}</td>
                                  <td valign="top" style="font-size:16px;line-height:24px;font-weight:700;color:#111827;">
                                    ${escapeHtml(issue.title)}
                                  </td>
                                </tr>
                              </table>
                            </td>
                            <td align="right" valign="top" style="white-space:nowrap;padding:0 0 10px 0;">
                              <span style="display:inline-block;border:1px solid ${priority.border};background:${priority.background};color:${priority.text};border-radius:999px;padding:6px 10px;font-size:11px;line-height:11px;font-weight:700;letter-spacing:0.4px;">
                                ${priority.label}
                              </span>
                            </td>
                          </tr>
                        </table>
                        <p style="margin:0 0 10px 0;font-size:14px;line-height:22px;color:#6B7280;">
                          ${escapeHtml(truncateText(issue.subtitle, 150))}
                        </p>
                        <a href="${escapeHtml(issue.learnMoreUrl)}" style="font-size:14px;line-height:20px;font-weight:700;color:${accent};text-decoration:none;">
                          Learn more &rarr;
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          `;
        })
        .join("")
    : `
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;border:1px solid #E5E7EB;border-left:4px solid #3B82F6;border-radius:8px;background:#FFFFFF;box-shadow:0 6px 18px rgba(15,23,42,0.06);">
          <tr>
            <td style="padding:18px 18px 16px 18px;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td valign="top" style="font-size:16px;line-height:24px;font-weight:700;color:#111827;padding:0 12px 10px 0;">
                    No urgent issues need attention this week
                  </td>
                  <td align="right" valign="top" style="white-space:nowrap;padding:0 0 10px 0;">
                    <span style="display:inline-block;border:1px solid #BFDBFE;background:#DBEAFE;color:#1D4ED8;border-radius:999px;padding:6px 10px;font-size:11px;line-height:11px;font-weight:700;letter-spacing:0.4px;">
                      LOW PRIORITY
                    </span>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:14px;line-height:22px;color:#6B7280;">
                This week looks stable overall, so the focus can stay on small improvements and ongoing monitoring.
              </p>
            </td>
          </tr>
        </table>
      `;
  const quickWinsMarkup = quickWins
    .map((win, index) => {
      const difficultyTone = getDifficultyTone(win.effortMinutes);
      const timeEstimate = win.difficulty.includes("/") ? win.difficulty.split("/").slice(1).join("/").trim() : win.difficulty;

      return `
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
          <tr>
            <td style="padding:0 0 ${index < quickWins.length - 1 ? 12 : 0}px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;border:1px solid #E2E8F0;border-radius:8px;background:#FFFFFF;">
                <tr>
                  <td valign="top" style="width:44px;padding:18px 0 18px 18px;">
                    <table width="28" cellpadding="0" cellspacing="0" role="presentation" style="width:28px;height:28px;background:#DCFCE7;border-radius:999px;">
                      <tr>
                        <td align="center" valign="middle" style="font-size:15px;line-height:15px;color:#166534;font-weight:700;">&#10003;</td>
                      </tr>
                    </table>
                  </td>
                  <td valign="top" style="padding:18px 18px 18px 12px;">
                    <p style="margin:0 0 6px 0;font-size:15px;line-height:22px;font-weight:700;color:#111827;">
                      ${escapeHtml(win.quickAction)}
                    </p>
                    <p style="margin:0 0 8px 0;font-size:14px;line-height:22px;color:#6B7280;">
                      Est. Impact: ${escapeHtml(win.quickImpact)}
                    </p>
                    <p style="margin:0;font-size:13px;line-height:20px;color:#6B7280;">
                      Difficulty:
                      <span style="display:inline-block;margin:0 6px;border:1px solid ${difficultyTone.border};background:${difficultyTone.background};color:${difficultyTone.text};border-radius:999px;padding:4px 10px;font-size:11px;line-height:11px;font-weight:700;vertical-align:middle;">
                        ${difficultyTone.label}
                      </span>
                      <span style="color:#94A3B8;">${escapeHtml(timeEstimate)}</span>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      `;
    })
    .join("");
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
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;background:#F4F6F9;margin:0;padding:0;">
        <tr>
          <td align="center" style="padding:32px 12px;">
            <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="width:600px;max-width:600px;background:#FFFFFF;border-collapse:separate;border-spacing:0;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;">
              <tr>
                <td style="background:#0F172A;padding:0;">
                  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                    <tr>
                      <td style="padding:22px 24px;font-family:Arial,Helvetica,sans-serif;">
                        <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                          <tr>
                            <td valign="middle" style="font-size:24px;line-height:28px;font-weight:700;color:#FFFFFF;letter-spacing:0.2px;">
                              SitePulse
                            </td>
                            <td align="right" valign="middle" style="font-size:13px;line-height:20px;color:#94A3AF;">
                              Weekly Performance Report &middot; ${escapeHtml(reportMonthYear)}
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td style="height:4px;background:${accent};font-size:0;line-height:0;">&nbsp;</td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:24px;font-family:Arial,Helvetica,sans-serif;color:#111827;">
                  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                    <tr>
                      <td style="padding:0 0 24px 0;">
                        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;border:1px solid #E5E7EB;border-radius:8px;background:#FFFFFF;">
                          <tr>
                            <td style="padding:28px 24px 24px 24px;">
                              <p style="margin:0 0 8px 0;font-size:12px;line-height:12px;letter-spacing:0.6px;text-transform:uppercase;color:#94A3AF;font-weight:700;">
                                Weekly website report
                              </p>
                              <h1 style="margin:0 0 10px 0;font-size:30px;line-height:38px;font-weight:700;color:#111827;">
                                Weekly Website Report for ${escapeHtml(clientWebsiteName)}
                              </h1>
                              <p style="margin:0 0 8px 0;font-size:16px;line-height:24px;font-weight:700;">
                                <a href="${escapeHtml(websiteUrl)}" style="color:#2563EB;text-decoration:none;">${escapeHtml(websiteHost)}</a>
                              </p>
                              <p style="margin:0 0 20px 0;font-size:13px;line-height:20px;color:#9CA3AF;">
                                ${escapeHtml(reportDate)}
                              </p>
                              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;background:#EFF6FF;border-left:4px solid ${accent};border-radius:8px;">
                                <tr>
                                  <td style="padding:16px 18px;">
                                    <p style="margin:0 0 8px 0;font-size:12px;line-height:12px;letter-spacing:0.6px;text-transform:uppercase;color:#2563EB;font-weight:700;">
                                      Why this matters now
                                    </p>
                                    <p style="margin:0 0 6px 0;font-size:14px;line-height:22px;color:#1E3A8A;">
                                      ${escapeHtml(heroSummaryPrimary)}
                                    </p>
                                    <p style="margin:0;font-size:14px;line-height:22px;color:#475569;">
                                      ${escapeHtml(heroSummarySecondary)}
                                    </p>
                                  </td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:0 0 24px 0;">
                        ${renderScoreSummary(input.scan, input.previousScan)}
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:0 0 28px 0;">
                        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;border:1px solid #FDE68A;border-left:4px solid #F59E0B;border-radius:8px;background:#FFFBEB;">
                          <tr>
                            <td style="padding:20px 20px 16px 20px;">
                              <p style="margin:0 0 12px 0;font-size:12px;line-height:12px;letter-spacing:0.6px;text-transform:uppercase;color:#B45309;font-weight:700;">
                                What this means for your business
                              </p>
                              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                                ${businessImpactMarkup}
                              </table>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>

                    <tr>
                      <td style="padding:0;">
                        ${sectionDivider()}
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:0 0 16px 0;">
                        <h2 style="margin:0 0 6px 0;font-size:28px;line-height:34px;font-weight:700;color:#111827;">
                          What needs your attention
                        </h2>
                        <p style="margin:0;font-size:14px;line-height:22px;color:#6B7280;">
                          Top issues sorted by priority
                        </p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:0 0 28px 0;">
                        ${issuesMarkup}
                      </td>
                    </tr>

                    <tr>
                      <td style="padding:0;">
                        ${sectionDivider()}
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:0 0 16px 0;">
                        <h2 style="margin:0 0 6px 0;font-size:24px;line-height:30px;font-weight:700;color:#111827;">
                          3 quick wins to improve this week
                        </h2>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:0 0 28px 0;">
                        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;border:1px solid #E2E8F0;border-radius:8px;background:#F8FAFC;">
                          <tr>
                            <td style="padding:18px 18px 16px 18px;">
                              ${quickWinsMarkup}
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>

                    <tr>
                      <td style="padding:0;">
                        ${sectionDivider()}
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:0;">
                        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;border:1px solid #BFDBFE;border-radius:8px;background:#EFF6FF;">
                          <tr>
                            <td style="padding:22px 22px 20px 22px;text-align:center;">
                                              <p style="margin:0 0 8px 0;font-size:12px;line-height:12px;letter-spacing:0.6px;text-transform:uppercase;color:#2563EB;font-weight:700;">
                                &#128202; Your live dashboard
                              </p>
                              <p style="margin:0 0 16px 0;font-size:22px;line-height:30px;font-weight:700;color:#1D4ED8;">
                                See your live SEO data anytime &mdash; no login needed.
                              </p>
                              <table align="center" cellpadding="0" cellspacing="0" role="presentation">
                                <tr>
                                  <td align="center" style="border-radius:8px;background:#2563EB;">
                                    <a href="${escapeHtml(liveDashboardUrl)}" style="display:inline-block;padding:14px 24px;font-size:15px;line-height:20px;font-weight:700;color:#FFFFFF;text-decoration:none;">
                                      View Your Dashboard &rarr;
                                    </a>
                                  </td>
                                </tr>
                              </table>
                              <p style="margin:12px 0 0 0;font-size:12px;line-height:18px;color:#6B7280;">
                                ${escapeHtml(dashboardLinkText)}
                              </p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <tr>
                <td style="padding:24px;background:#F9FAFB;border-top:1px solid #E5E7EB;text-align:center;font-family:Arial,Helvetica,sans-serif;">
                  <p style="margin:0 0 12px 0;font-size:13px;line-height:20px;color:#6B7280;">
                    This automated report was generated by SitePulse for ${escapeHtml(input.to)}
                  </p>
                  <p style="margin:0 0 12px 0;font-size:13px;line-height:20px;color:#6B7280;">
                    <a href="${escapeHtml(manageReportsUrl)}" style="color:${accent};text-decoration:none;">Manage Reports</a>
                    <span style="color:#CBD5E1;"> &middot; </span>
                    <a href="${escapeHtml(billingUrl)}" style="color:${accent};text-decoration:none;">Billing</a>
                    <span style="color:#CBD5E1;"> &middot; </span>
                    <a href="${escapeHtml(unsubscribeUrl)}" style="color:${accent};text-decoration:none;">Unsubscribe</a>
                    <span style="color:#CBD5E1;"> &middot; </span>
                    <a href="${escapeHtml(helpUrl)}" style="color:${accent};text-decoration:none;">Help</a>
                  </p>
                  <p style="margin:0 0 6px 0;font-size:12px;line-height:18px;color:#9CA3AF;">
                    &copy; ${reportYear} SitePulse
                  </p>
                  <p style="margin:0;font-size:12px;line-height:18px;color:#9CA3AF;">
                    Made for agencies, not developers.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
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

