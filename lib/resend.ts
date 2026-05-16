import "server-only";

import { Resend, type CreateEmailOptions, type CreateEmailResponse } from "resend";

import type {
  AgencyBranding,
  BrokenLinkRecord,
  EmailTemplateId,
  ScanFrequency,
  ScanResult,
  SecurityHeadersRecord,
  UserProfile,
  Website
} from "@/types";
import { hasSentEmailWithDedupeKey, logEmailDelivery } from "@/lib/admin/logging";
import { buildReportEmailTemplate } from "@/lib/report-email-template";
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

type EmailKind = "report" | "alert" | "product";
type AlertEmailTemplateId =
  | "alert_score_drop"
  | "alert_critical_score"
  | "alert_scan_failure"
  | "alert_ssl_expiry"
  | "alert_uptime"
  | "alert_competitor";
type ProductEmailTemplateId = Exclude<EmailTemplateId, AlertEmailTemplateId | "report_weekly" | "report_monthly" | "report_manual">;
type SharedEmailSendInput = {
  kind: EmailKind;
  templateId: EmailTemplateId;
  dedupeKey: string;
  campaign: string;
  to: string;
  fromName: string;
  fromEmail?: string;
  replyTo?: CreateEmailOptions["replyTo"];
  subject: string;
  html: string;
  metadata?: EmailLogPayload;
  attachments?: CreateEmailOptions["attachments"];
  triggeredAt?: string | null;
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

function parsePositiveInt(raw: string | undefined, fallback: number) {
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitMessage(message: string) {
  return /too many requests|rate limit/i.test(message);
}

function isRateLimitedResponse(response: CreateEmailResponse | undefined) {
  const responseError = response?.error as { statusCode?: number; message?: string } | undefined;
  return responseError?.statusCode === 429 || isRateLimitMessage(responseError?.message ?? "");
}

function getResendMinIntervalMs() {
  return parsePositiveInt(process.env.RESEND_MIN_INTERVAL_MS, 800);
}

function getResendRetryDelayMs(attempt: number) {
  const baseDelayMs = parsePositiveInt(process.env.RESEND_RETRY_DELAY_MS, 1500);
  return baseDelayMs * attempt;
}

let nextEmailSendAt = 0;
let emailSendQueue: Promise<void> = Promise.resolve();

async function withEmailSendSlot<T>(operation: () => Promise<T>) {
  const previousSend = emailSendQueue.catch(() => undefined);
  let releaseSlot!: () => void;

  emailSendQueue = new Promise<void>((resolve) => {
    releaseSlot = resolve;
  });

  await previousSend;

  try {
    const now = Date.now();
    const waitMs = Math.max(0, nextEmailSendAt - now);

    if (waitMs > 0) {
      await sleep(waitMs);
    }

    nextEmailSendAt = Date.now() + getResendMinIntervalMs();
    return await operation();
  } finally {
    releaseSlot();
  }
}

function getConfiguredFromEmail(kind: EmailKind) {
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

async function sendEmailWithConfirmation(input: SharedEmailSendInput) {
  if (await hasSentEmailWithDedupeKey(input.dedupeKey)) {
    logEmailEvent("info", "dedupe_skip", {
      kind: input.kind,
      templateId: input.templateId,
      dedupeKey: input.dedupeKey,
      campaign: input.campaign,
      to: input.to,
      subject: input.subject,
      ...input.metadata
    });

    return null;
  }

  const resend = getResendClient();
  const fromEmail = input.fromEmail ?? getConfiguredFromEmail(input.kind);
  const maxAttempts = parsePositiveInt(process.env.RESEND_MAX_ATTEMPTS, 3);
  const websiteId = typeof input.metadata?.websiteId === "string" ? input.metadata.websiteId : null;
  const userId = typeof input.metadata?.userId === "string" ? input.metadata.userId : null;
  const payload: CreateEmailOptions = {
    from: `${input.fromName} <${fromEmail}>`,
    to: input.to,
    replyTo: input.replyTo,
    subject: input.subject,
    html: input.html,
    attachments: input.attachments
  };

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let response: CreateEmailResponse;

    try {
      response = await withEmailSendSlot(async () => {
        logEmailEvent("info", "request", {
          kind: input.kind,
          templateId: input.templateId,
          dedupeKey: input.dedupeKey,
          campaign: input.campaign,
          to: input.to,
          from: fromEmail,
          subject: input.subject,
          attachments: input.attachments?.map((attachment) => attachment.filename) ?? [],
          attempt,
          ...input.metadata
        });

        return resend.emails.send(payload);
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown email provider error.";
      const rateLimited = isRateLimitMessage(message);

      logEmailEvent(rateLimited ? "warn" : "error", "exception", {
        kind: input.kind,
        templateId: input.templateId,
        dedupeKey: input.dedupeKey,
        campaign: input.campaign,
        to: input.to,
        from: fromEmail,
        subject: input.subject,
        error: message,
        attempt,
        ...input.metadata
      });

      if (rateLimited && attempt < maxAttempts) {
        await sleep(getResendRetryDelayMs(attempt));
        continue;
      }

      await logEmailDelivery({
        to: input.to,
        subject: input.subject,
        kind: input.kind,
        templateId: input.templateId,
        dedupeKey: input.dedupeKey,
        campaign: input.campaign,
        status: "failed",
        websiteId,
        userId,
        errorMessage: message,
        metadata: input.metadata,
        triggeredAt: input.triggeredAt
      });

      throw new Error(`Unable to send email: ${message}`);
    }

    logEmailEvent("info", "response", {
      kind: input.kind,
      templateId: input.templateId,
      dedupeKey: input.dedupeKey,
      campaign: input.campaign,
      to: input.to,
      from: fromEmail,
      subject: input.subject,
      data: response.data,
      error: response.error,
      attempt,
      ...input.metadata
    });

    if (!response.error && response.data?.id) {
      await logEmailDelivery({
        to: input.to,
        subject: input.subject,
        kind: input.kind,
        templateId: input.templateId,
        dedupeKey: input.dedupeKey,
        campaign: input.campaign,
        status: "sent",
        websiteId,
        userId,
        providerMessageId: response.data.id,
        metadata: input.metadata,
        triggeredAt: input.triggeredAt
      });

      return {
        provider: "resend" as const,
        messageId: response.data.id,
        to: input.to,
        from: fromEmail,
        subject: input.subject
      };
    }

    const message =
      response.error?.message ??
      "Email provider did not return a message ID, so delivery could not be confirmed.";
    const rateLimited = isRateLimitedResponse(response);

    logEmailEvent(rateLimited ? "warn" : "error", "rejected", {
      kind: input.kind,
      templateId: input.templateId,
      dedupeKey: input.dedupeKey,
      campaign: input.campaign,
      to: input.to,
      from: fromEmail,
      subject: input.subject,
      error: message,
      attempt,
      ...input.metadata
    });

    if (rateLimited && attempt < maxAttempts) {
      await sleep(getResendRetryDelayMs(attempt));
      continue;
    }

    await logEmailDelivery({
      to: input.to,
      subject: input.subject,
      kind: input.kind,
      templateId: input.templateId,
      dedupeKey: input.dedupeKey,
      campaign: input.campaign,
      status: "failed",
      websiteId,
      userId,
      errorMessage: message,
      metadata: input.metadata,
      triggeredAt: input.triggeredAt
    });

    throw new Error(`Unable to send email: ${message}`);
  }

  throw new Error("Unable to send email: Retry limit reached.");
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

function renderPreheader(text: string) {
  return `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(text)}</div>`;
}

function renderDetailGrid(details: Array<{ label: string; value: string }>) {
  if (!details.length) {
    return "";
  }

  return `
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;margin:0 0 24px 0;">
      <tr>
        ${details
          .map(
            (detail) => `
              <td valign="top" style="padding:0 8px 8px 0;">
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;border:1px solid #E2E8F0;border-radius:14px;background:#F8FAFC;">
                  <tr>
                    <td style="padding:14px 16px;">
                      <p style="margin:0 0 6px 0;font-size:11px;line-height:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#64748B;">
                        ${escapeHtml(detail.label)}
                      </p>
                      <p style="margin:0;font-size:16px;line-height:22px;font-weight:700;color:#0F172A;">
                        ${escapeHtml(detail.value)}
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            `
          )
          .join("")}
      </tr>
    </table>
  `;
}

function renderPrimaryButton(label: string, href: string, accent: string) {
  return `
    <table cellpadding="0" cellspacing="0" role="presentation">
      <tr>
        <td align="center" style="border-radius:999px;background:${accent};">
          <a href="${escapeHtml(href)}" style="display:inline-block;padding:14px 22px;font-size:15px;line-height:20px;font-weight:700;color:#FFFFFF;text-decoration:none;">
            ${escapeHtml(label)}
          </a>
        </td>
      </tr>
    </table>
  `;
}

function renderSecondaryLink(label: string, href: string, accent: string) {
  return `<a href="${escapeHtml(href)}" style="font-size:14px;line-height:20px;font-weight:700;color:${accent};text-decoration:none;">${escapeHtml(label)} &rarr;</a>`;
}

function renderEmailLayout(input: {
  preheader: string;
  accent: string;
  eyebrow: string;
  title: string;
  summary: string;
  bodyHtml: string;
  ctaLabel: string;
  ctaUrl: string;
  secondaryLabel?: string | null;
  secondaryUrl?: string | null;
  details?: Array<{ label: string; value: string }>;
  footerLinks?: Array<{ label: string; href: string }>;
  footerNote?: string;
  supportLabel?: string;
}) {
  const footerLinks =
    input.footerLinks?.length
      ? input.footerLinks
          .map((link) => `<a href="${escapeHtml(link.href)}" style="color:${input.accent};text-decoration:none;">${escapeHtml(link.label)}</a>`)
          .join(`<span style="color:#CBD5E1;"> &middot; </span>`)
      : "";

  return `
    ${renderPreheader(input.preheader)}
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;background:#F4F6F9;margin:0;padding:0;">
      <tr>
        <td align="center" style="padding:32px 12px;">
          <table width="620" cellpadding="0" cellspacing="0" role="presentation" style="width:620px;max-width:620px;background:#FFFFFF;border-collapse:separate;border-spacing:0;border:1px solid #E2E8F0;border-radius:24px;overflow:hidden;">
            <tr>
              <td style="background:#0F172A;padding:0;">
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                  <tr>
                    <td style="padding:24px 28px;font-family:Arial,Helvetica,sans-serif;">
                      <p style="margin:0;font-size:24px;line-height:28px;font-weight:700;color:#FFFFFF;letter-spacing:0.02em;">
                        SitePulse
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="height:4px;background:${input.accent};font-size:0;line-height:0;">&nbsp;</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;font-family:Arial,Helvetica,sans-serif;color:#0F172A;">
                <p style="margin:0 0 10px 0;font-size:12px;line-height:12px;letter-spacing:0.08em;text-transform:uppercase;color:#64748B;font-weight:700;">
                  ${escapeHtml(input.eyebrow)}
                </p>
                <h1 style="margin:0 0 12px 0;font-size:31px;line-height:38px;font-weight:700;color:#0F172A;">
                  ${escapeHtml(input.title)}
                </h1>
                <p style="margin:0 0 24px 0;font-size:16px;line-height:26px;color:#475569;">
                  ${escapeHtml(input.summary)}
                </p>
                ${renderDetailGrid(input.details ?? [])}
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;border:1px solid #E2E8F0;border-radius:20px;background:#FFFFFF;">
                  <tr>
                    <td style="padding:22px 22px 18px 22px;">
                      ${input.bodyHtml}
                    </td>
                  </tr>
                </table>
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;margin-top:24px;">
                  <tr>
                    <td valign="middle" style="padding:0 16px 0 0;">
                      ${renderPrimaryButton(input.ctaLabel, input.ctaUrl, input.accent)}
                    </td>
                    <td valign="middle">
                      ${input.secondaryLabel && input.secondaryUrl ? renderSecondaryLink(input.secondaryLabel, input.secondaryUrl, input.accent) : ""}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 28px;background:#F8FAFC;border-top:1px solid #E2E8F0;text-align:center;font-family:Arial,Helvetica,sans-serif;">
                ${footerLinks ? `<p style="margin:0 0 10px 0;font-size:13px;line-height:20px;color:#64748B;">${footerLinks}</p>` : ""}
                <p style="margin:0 0 6px 0;font-size:12px;line-height:18px;color:#94A3B8;">
                  ${escapeHtml(input.footerNote ?? "SitePulse keeps client reporting, alerts, and follow-up moving in one place.")}
                </p>
                <p style="margin:0;font-size:12px;line-height:18px;color:#94A3B8;">
                  ${escapeHtml(input.supportLabel ?? "Made for agencies, not developers.")}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
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

function getEmailFooterLinks(baseUrl: string) {
  return [
    {
      label: "Dashboard",
      href: `${baseUrl}/dashboard`
    },
    {
      label: "Reports",
      href: `${baseUrl}/dashboard/reports`
    },
    {
      label: "Billing",
      href: `${baseUrl}/dashboard/billing`
    },
    {
      label: "Settings",
      href: `${baseUrl}/dashboard/settings`
    }
  ];
}

function getAlertEmailContent(input: {
  templateId: AlertEmailTemplateId;
  website: Website;
  reason: string;
}) {
  switch (input.templateId) {
    case "alert_score_drop":
      return {
        subject: `Alert: ${input.website.label} dropped in performance`,
        eyebrow: "Performance alert",
        title: `${input.website.label} lost ground`,
        summary: "A recent scan showed a meaningful performance drop that could affect client confidence and conversion quality.",
        guidance:
          "Review the latest scan, confirm what changed, and decide whether this needs a fast fix or a short client explanation today."
      };
    case "alert_critical_score":
      return {
        subject: `Alert: ${input.website.label} is in the critical zone`,
        eyebrow: "Critical score alert",
        title: `${input.website.label} needs immediate attention`,
        summary: "The latest scan moved this website into a critical score range, so it is worth reviewing before the issue compounds.",
        guidance:
          "Start with the highest-impact fixes in the latest scan and prepare a simple next-step update for the client or internal team."
      };
    case "alert_scan_failure":
      return {
        subject: `Alert: SitePulse could not scan ${input.website.label}`,
        eyebrow: "Scan failure",
        title: `A scheduled scan failed for ${input.website.label}`,
        summary: "The monitoring workflow could not complete the latest scan, which means the next report or alert might miss fresh data.",
        guidance:
          "Check the website status, recent deploys, and any blockers that would prevent SitePulse from completing the scan successfully."
      };
    case "alert_ssl_expiry":
      return {
        subject: `Alert: SSL renewal needed for ${input.website.label}`,
        eyebrow: "SSL alert",
        title: `${input.website.label} needs certificate attention`,
        summary: "The SSL certificate window is now close enough to create risk for visitors, trust signals, and uninterrupted availability.",
        guidance:
          "Review the expiry date, confirm ownership of the certificate, and schedule the renewal before browsers start showing warnings."
      };
    case "alert_uptime":
      return {
        subject: `Alert: ${input.website.label} appears offline`,
        eyebrow: "Uptime alert",
        title: `${input.website.label} may be down`,
        summary: "An uptime check detected downtime or a failed response, so this website needs a quick review before the incident grows.",
        guidance:
          "Confirm the outage, check hosting and monitoring data, and decide whether the client needs an immediate heads-up."
      };
    case "alert_competitor":
      return {
        subject: `Alert: competitor movement detected for ${input.website.label}`,
        eyebrow: "Competitor alert",
        title: `A competitor moved on ${input.website.label}`,
        summary: "A tracked competitor changed enough to matter, which is a useful moment to review your positioning and next actions.",
        guidance:
          "Compare the latest competitor movement against your own site scores and use it to prioritize the fixes or wins worth sharing."
      };
  }
}

export async function sendProductEmail(input: {
  templateId: ProductEmailTemplateId;
  dedupeKey: string;
  campaign: string;
  to: string;
  subject: string;
  preheader: string;
  eyebrow: string;
  title: string;
  summary: string;
  bodyHtml: string;
  ctaLabel: string;
  ctaUrl: string;
  secondaryLabel?: string | null;
  secondaryUrl?: string | null;
  details?: Array<{ label: string; value: string }>;
  accent?: string;
  fromName?: string;
  metadata?: EmailLogPayload;
  triggeredAt?: string | null;
}) {
  const baseUrl = ensureHttpsUrl(getBaseUrl()).replace(/\/$/, "");

  return sendEmailWithConfirmation({
    kind: "product",
    templateId: input.templateId,
    dedupeKey: input.dedupeKey,
    campaign: input.campaign,
    to: input.to,
    fromName: input.fromName ?? "SitePulse",
    subject: input.subject,
    metadata: input.metadata,
    triggeredAt: input.triggeredAt,
    html: renderEmailLayout({
      preheader: input.preheader,
      accent: input.accent ?? "#2563EB",
      eyebrow: input.eyebrow,
      title: input.title,
      summary: input.summary,
      bodyHtml: input.bodyHtml,
      ctaLabel: input.ctaLabel,
      ctaUrl: input.ctaUrl,
      secondaryLabel: input.secondaryLabel,
      secondaryUrl: input.secondaryUrl,
      details: input.details,
      footerLinks: getEmailFooterLinks(baseUrl)
    })
  });
}

export async function sendScanPausedEmail(input: {
  dedupeKey: string;
  to: string;
  website: Website;
  triggeredAt?: string | null;
}) {
  const baseUrl = ensureHttpsUrl(getBaseUrl()).replace(/\/$/, "");
  const dashboardUrl = `${baseUrl}/dashboard`;

  return sendProductEmail({
    templateId: "scan_paused",
    dedupeKey: input.dedupeKey,
    campaign: "operations",
    to: input.to,
    subject: `SitePulse: Scanning paused for ${input.website.url}`,
    preheader: `Scanning was paused for ${input.website.url} after the latest scan could not complete.`,
    eyebrow: "Scanning paused",
    title: `Scanning paused for ${input.website.label}`,
    summary:
      `We were unable to complete the latest scan for ${input.website.url}. ` +
      "This usually happens when a site blocks automated scanners or takes too long to respond.",
    bodyHtml: `
      <p style="margin:0 0 14px 0;font-size:15px;line-height:24px;color:#475569;">
        We were unable to complete the latest scan for ${escapeHtml(input.website.url)}.
        This usually happens when a site blocks automated scanners or takes too long to respond.
      </p>
      <p style="margin:0;font-size:15px;line-height:24px;color:#475569;">
        Visit your dashboard to resume scanning or remove this site.
      </p>
    `,
    ctaLabel: "Open dashboard",
    ctaUrl: dashboardUrl,
    secondaryLabel: "Review website",
    secondaryUrl: `${dashboardUrl}/websites/${input.website.id}`,
    details: [
      {
        label: "Website",
        value: input.website.label
      },
      {
        label: "URL",
        value: input.website.url
      }
    ],
    metadata: {
      websiteId: input.website.id,
      userId: input.website.user_id,
      dedupeKey: input.dedupeKey
    },
    triggeredAt: input.triggeredAt ?? new Date().toISOString()
  });
}

function getReportEmailBranding(profile: Pick<UserProfile, "plan">, branding?: AgencyBranding | null) {
  if (profile.plan !== "agency") {
    return {
      whiteLabelEnabled: false,
      branding: null as AgencyBranding | null
    };
  }

  return {
    whiteLabelEnabled: Boolean(branding),
    branding: branding ?? null
  };
}

export async function sendReportEmail(input: {
  to: string;
  reportId: string;
  website: Website;
  profile: UserProfile;
  branding?: AgencyBranding | null;
  scan: ScanResult;
  previousScan?: ScanResult | null;
  healthScore?: number | null;
  securityHeaders?: SecurityHeadersRecord | null;
  brokenLinks?: BrokenLinkRecord | null;
  pdfBuffer: Buffer;
  dashboardUrl?: string | null;
  deliveryMode: "manual" | "scheduled";
  frequency: ScanFrequency;
  dedupeKey: string;
  triggeredAt?: string | null;
}) {
  const baseUrl = getBaseUrl();
  const template = buildReportEmailTemplate({
    to: input.to,
    website: input.website,
    profile: input.profile,
    branding: input.branding,
    scan: input.scan,
    previousScan: input.previousScan,
    securityHeaders: input.securityHeaders,
    brokenLinks: input.brokenLinks,
    dashboardUrl: input.dashboardUrl,
    deliveryMode: input.deliveryMode,
    frequency: input.frequency,
    baseUrl
  });
  const reportLabelLower = template.meta.label.toLowerCase();

  return sendEmailWithConfirmation({
    kind: "report",
    templateId: template.meta.templateId,
    dedupeKey: input.dedupeKey,
    campaign: template.meta.campaign,
    to: input.to,
    fromName: template.fromName,
    subject: template.subject,
    triggeredAt: input.triggeredAt ?? input.scan.scanned_at,
    metadata: {
      reportId: input.reportId,
      websiteId: input.website.id,
      userId: input.website.user_id,
      scanId: input.scan.id,
      recipient: input.to,
      reportMode: reportLabelLower,
      reportFrequency: input.frequency,
      clientDashboardEnabled: Boolean(input.dashboardUrl),
      dedupeKey: input.dedupeKey
    },
    replyTo: template.replyTo,
    html: template.html,
    attachments: [
      {
        filename: `${input.website.label.replace(/\s+/g, "-").toLowerCase()}-report.pdf`,
        content: input.pdfBuffer
      }
    ]
  });
}

function getSupportFromEmail() {
  const configured = process.env.SUPPORT_FROM_EMAIL?.trim() || "support@trysitepulse.com";

  if (process.env.NODE_ENV === "production" && configured.toLowerCase().endsWith("@resend.dev")) {
    throw new Error(
      "SUPPORT_FROM_EMAIL must use a verified sender domain in production."
    );
  }

  return configured;
}

function renderPlainTextHtml(value: string) {
  return escapeHtml(value).replace(/\n/g, "<br />");
}

export async function sendContactNotificationEmail(input: {
  messageId: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  createdAt: string;
}) {
  const baseUrl = ensureHttpsUrl(getBaseUrl()).replace(/\/$/, "");
  const supportFromEmail = getSupportFromEmail();

  return sendEmailWithConfirmation({
    kind: "product",
    templateId: "contact_message",
    dedupeKey: `contact-message:${input.messageId}`,
    campaign: "contact",
    to: "hello@trysitepulse.com",
    fromName: "SitePulse Contact",
    fromEmail: supportFromEmail,
    replyTo: input.email,
    subject: `New contact message: ${input.subject}`,
    triggeredAt: input.createdAt,
    metadata: {
      contactMessageId: input.messageId,
      senderEmail: input.email,
      senderName: input.name,
      contactSubject: input.subject
    },
    html: renderEmailLayout({
      preheader: `${input.name} sent a new contact message about ${input.subject}.`,
      accent: "#2563EB",
      eyebrow: "New contact message",
      title: input.subject,
      summary: `${input.name} sent a new message from the SitePulse contact page.`,
      details: [
        { label: "Name", value: input.name },
        { label: "Email", value: input.email },
        { label: "Received", value: formatDateTime(input.createdAt) }
      ],
      bodyHtml: `
        <p style="margin:0 0 12px 0;font-size:15px;line-height:24px;color:#475569;">
          ${renderPlainTextHtml(input.message)}
        </p>
      `,
      ctaLabel: "Open admin inbox",
      ctaUrl: `${baseUrl}/admin/messages`,
      secondaryLabel: "Open contact page",
      secondaryUrl: `${baseUrl}/contact`,
      footerLinks: getEmailFooterLinks(baseUrl),
      footerNote: "Reply directly from the admin inbox or from this email thread."
    })
  });
}

export async function sendContactReplyEmail(input: {
  messageId: string;
  to: string;
  name: string;
  subject: string;
  reply: string;
  originalMessage: string;
  createdAt: string;
}) {
  const baseUrl = ensureHttpsUrl(getBaseUrl()).replace(/\/$/, "");
  const supportFromEmail = getSupportFromEmail();

  return sendEmailWithConfirmation({
    kind: "product",
    templateId: "contact_reply",
    dedupeKey: `contact-reply:${input.messageId}`,
    campaign: "contact",
    to: input.to,
    fromName: "SitePulse Support",
    fromEmail: supportFromEmail,
    replyTo: supportFromEmail,
    subject: `Re: ${input.subject}`,
    triggeredAt: new Date().toISOString(),
    metadata: {
      contactMessageId: input.messageId,
      recipient: input.to,
      contactSubject: input.subject
    },
    html: renderEmailLayout({
      preheader: `Reply from SitePulse Support regarding ${input.subject}.`,
      accent: "#22C55E",
      eyebrow: "Support reply",
      title: `Re: ${input.subject}`,
      summary: `Hi ${input.name}, thanks for reaching out. A member of the SitePulse team has replied below.`,
      bodyHtml: `
        <div style="margin:0 0 20px 0;font-size:15px;line-height:24px;color:#475569;">
          ${renderPlainTextHtml(input.reply)}
        </div>
        <div style="border:1px solid #E5E7EB;border-radius:12px;background:#F8FAFC;padding:18px;">
          <p style="margin:0 0 8px 0;font-size:12px;line-height:12px;letter-spacing:0.6px;text-transform:uppercase;color:#64748B;font-weight:700;">
            Original message
          </p>
          <p style="margin:0 0 10px 0;font-size:13px;line-height:20px;color:#64748B;">
            Sent ${escapeHtml(formatDateTime(input.createdAt))}
          </p>
          <p style="margin:0;font-size:14px;line-height:22px;color:#475569;">
            ${renderPlainTextHtml(input.originalMessage)}
          </p>
        </div>
      `,
      ctaLabel: "Visit SitePulse",
      ctaUrl: baseUrl,
      secondaryLabel: "Contact page",
      secondaryUrl: `${baseUrl}/contact`,
      footerLinks: getEmailFooterLinks(baseUrl),
      footerNote: "You can reply directly to this email if you need anything else."
    })
  });
}

export async function sendCriticalAlertEmail(input: {
  templateId: AlertEmailTemplateId;
  dedupeKey: string;
  to: string;
  website: Website;
  scan: ScanResult;
  reason: string;
  branding?: AgencyBranding | null;
  triggeredAt?: string | null;
}) {
  const fromName = input.branding?.email_from_name || input.branding?.agency_name || "SitePulse Alerts";
  const baseUrl = ensureHttpsUrl(getBaseUrl()).replace(/\/$/, "");
  const content = getAlertEmailContent({
    templateId: input.templateId,
    website: input.website,
    reason: input.reason
  });
  const reviewUrl = `${baseUrl}/dashboard/websites/${input.website.id}`;
  const details = [
    {
      label: "Website",
      value: input.website.label
    },
    {
      label: "Performance",
      value: String(input.scan.performance_score)
    },
    {
      label: "Triggered",
      value: formatDateTime(input.triggeredAt ?? input.scan.scanned_at)
    }
  ];

  return sendEmailWithConfirmation({
    kind: "alert",
    templateId: input.templateId,
    dedupeKey: input.dedupeKey,
    campaign: "alerts",
    to: input.to,
    fromName,
    subject: content.subject,
    triggeredAt: input.triggeredAt ?? input.scan.scanned_at,
    metadata: {
      websiteId: input.website.id,
      userId: input.website.user_id,
      scanId: input.scan.id,
      reason: input.reason,
      dedupeKey: input.dedupeKey
    },
    html: renderEmailLayout({
      preheader: input.reason,
      accent: "#C2410C",
      eyebrow: content.eyebrow,
      title: content.title,
      summary: content.summary,
      details,
      bodyHtml: `
        <p style="margin:0 0 14px 0;font-size:15px;line-height:24px;color:#475569;">
          ${escapeHtml(input.reason)}
        </p>
        <p style="margin:0;font-size:15px;line-height:24px;color:#475569;">
          ${escapeHtml(content.guidance)}
        </p>
      `,
      ctaLabel: "Review the scan",
      ctaUrl: reviewUrl,
      secondaryLabel: "Open dashboard",
      secondaryUrl: `${baseUrl}/dashboard`,
      footerLinks: getEmailFooterLinks(baseUrl),
      footerNote: "Alerts help you stay ahead of client-facing issues before they become reactive conversations."
    })
  });
}

export async function trySendCriticalAlertEmail(input: {
  templateId: AlertEmailTemplateId;
  dedupeKey: string;
  to: string;
  website: Website;
  scan: ScanResult;
  reason: string;
  branding?: AgencyBranding | null;
  triggeredAt?: string | null;
}) {
  try {
    return await sendCriticalAlertEmail(input);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown alert delivery error.";

    logEmailEvent("warn", "alert_skipped", {
      templateId: input.templateId,
      dedupeKey: input.dedupeKey,
      to: input.to,
      websiteId: input.website.id,
      scanId: input.scan.id,
      reason: input.reason,
      error: message
    });

    return null;
  }
}

