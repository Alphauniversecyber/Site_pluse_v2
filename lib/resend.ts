import "server-only";

import { Resend, type CreateEmailOptions, type CreateEmailResponse } from "resend";

import type { AgencyBranding, ScanResult, Website } from "@/types";
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

function renderScoreSummary(scan: ScanResult) {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0; border: 1px solid #E2E8F0; border-radius: 22px;">
      <tr>
        ${[
          ["Performance", scan.performance_score],
          ["SEO", scan.seo_score],
          ["Accessibility", scan.accessibility_score],
          ["Best practices", scan.best_practices_score]
        ]
          .map(
            ([label, value]) => `
              <td style="padding: 18px; text-align: left; ${label !== "Best practices" ? "border-right: 1px solid #E2E8F0;" : ""}">
                <div style="font-size: 14px; color: #475569; margin-bottom: 12px;">${label}</div>
                <div style="font-size: 24px; font-weight: 700; color: #0F172A; line-height: 1; display: inline-flex; align-items: center; gap: 10px;">
                  <span style="display: inline-block; width: 14px; height: 14px; border: 4px solid #22C55E; border-radius: 999px;"></span>
                  ${value}
                </div>
              </td>
            `
          )
          .join("")}
      </tr>
    </table>
  `;
}

function renderChangeCard(value: string, label: string, tone: "positive" | "negative") {
  const palette =
    tone === "positive"
      ? {
          background: "#ECFDF5",
          border: "#BBF7D0",
          badge: "#16A34A",
          text: "#1E293B"
        }
      : {
          background: "#FEF2F2",
          border: "#FECACA",
          badge: "#DC2626",
          text: "#1E293B"
        };

  return `
    <div style="margin-bottom: 14px; border-radius: 18px; border: 1px solid ${palette.border}; background: ${palette.background}; padding: 16px 18px;">
      <span style="display: inline-block; border-radius: 12px; background: ${palette.badge}; color: #FFFFFF; padding: 6px 10px; font-size: 18px; font-weight: 700; margin-right: 12px;">${value}</span>
      <span style="font-size: 20px; color: ${palette.text};">${label}</span>
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
  pdfBuffer: Buffer;
}) {
  const baseUrl = getBaseUrl();
  const issues = input.scan.issues.slice(0, 3);
  const fromName = input.branding?.email_from_name || input.branding?.agency_name || "SitePulse";
  const accent = input.branding?.brand_color || "#3B82F6";
  const logo = input.branding?.logo_url || `${baseUrl}/brand/sitepulse-logo-dark.svg`;
  const accessibilityCount = input.scan.accessibility_violations?.length ?? 0;
  const performanceDelta =
    input.previousScan !== null && input.previousScan !== undefined
      ? input.scan.performance_score - input.previousScan.performance_score
      : null;
  const keyIssue = issues[0]?.title ?? "Website performance needs review";
  const subject =
    performanceDelta !== null && performanceDelta < 0
      ? `⚠ Weekly Report: Performance dropped by ${Math.abs(performanceDelta)} points`
      : performanceDelta !== null && performanceDelta > 0
        ? `Weekly Report: Performance improved by ${performanceDelta} points`
        : `Weekly Report: ${input.website.label} needs attention`;

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
      <div style="font-family: Arial, sans-serif; background: #F8FAFC; padding: 32px 20px;">
        <div style="max-width: 1080px; margin: 0 auto; border-radius: 26px; overflow: hidden; border: 1px solid #E2E8F0; background: #FFFFFF; box-shadow: 0 30px 80px -40px rgba(15, 23, 42, 0.45);">
          <div style="background: #0F172A; padding: 24px 32px;">
            <img src="${logo}" alt="${fromName}" style="max-height: 42px; max-width: 220px; width: auto; height: auto; object-fit: contain; display: block;" />
          </div>

          <div style="padding: 36px 32px 18px; text-align: center;">
            <h1 style="margin: 0; font-size: 40px; line-height: 1.1; color: #0F172A;">Client-ready weekly website report</h1>
            <p style="margin: 14px 0 0; font-size: 24px; color: #64748B;">${input.website.url.replace(/^https?:\/\//, "")}</p>
            <p style="margin: 10px 0 0; font-size: 15px; color: #94A3B8;">Scanned ${formatDateTime(input.scan.scanned_at)}</p>
          </div>

          <div style="padding: 0 32px 24px;">
            <div style="border-radius: 22px; border: 1px solid #DBEAFE; background: #EFF6FF; padding: 18px 20px;">
              <p style="margin: 0; font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase; color: #2563EB; font-weight: 700;">
                Why this matters now
              </p>
              <p style="margin: 10px 0 0; font-size: 18px; line-height: 1.6; color: #1E293B;">
                ${performanceDelta !== null && performanceDelta < 0
                  ? `Urgency: this website dropped ${Math.abs(performanceDelta)} performance points since the last report.`
                  : "Urgency: this website still has visible opportunities to improve client-facing performance and trust."}
              </p>
              <p style="margin: 8px 0 0; font-size: 16px; line-height: 1.7; color: #475569;">
                Key issue: ${keyIssue}. Open the full report to review the fixes, expected impact, and next client-ready talking points.
              </p>
            </div>
          </div>

          <div style="padding: 0 32px 8px;">
            ${renderScoreSummary(input.scan)}
          </div>

          <table width="100%" cellpadding="0" cellspacing="0" style="padding: 0 32px 24px;">
            <tr>
              <td valign="top" style="width: 42%; padding: 20px 16px 32px 32px;">
                <h2 style="margin: 0 0 20px; font-size: 24px; color: #0F172A;">What needs your attention</h2>
                ${
                  performanceDelta !== null
                    ? renderChangeCard(
                        `${performanceDelta > 0 ? "+" : ""}${performanceDelta}`,
                        performanceDelta >= 0 ? "Performance moved in the right direction" : "Performance dropped since last week",
                        performanceDelta >= 0 ? "positive" : "negative"
                      )
                    : renderChangeCard("+0", "This is your first comparison point for performance", "positive")
                }
                ${renderChangeCard(
                  `${accessibilityCount}`,
                  accessibilityCount === 1
                    ? "Accessibility issue needs review"
                    : "Accessibility issues currently detected",
                  accessibilityCount > 0 ? "negative" : "positive"
                )}

                <a href="${baseUrl}/dashboard/websites/${input.website.id}" style="display: inline-block; margin-top: 12px; border-radius: 16px; background: ${accent}; color: #FFFFFF; text-decoration: none; padding: 16px 28px; font-size: 18px; font-weight: 700;">
                  View full report
                </a>
              </td>

              <td valign="top" style="padding: 20px 32px 32px 24px; border-left: 1px solid #E2E8F0;">
                <h2 style="margin: 0 0 20px; font-size: 24px; color: #0F172A;">Top issue summary</h2>
                <ul style="margin: 0; padding-left: 22px; color: #475569; font-size: 18px; line-height: 1.7;">
                  ${
                    issues.length
                      ? issues
                          .map(
                            (issue) =>
                              `<li style="margin-bottom: 12px;"><span style="font-weight: 700; color: ${accent};">${issue.title}:</span> ${issue.description}</li>`
                          )
                          .join("")
                      : "<li>No critical issues were detected in this scan.</li>"
                  }
                </ul>
              </td>
            </tr>
          </table>

          <div style="border-top: 1px solid #E2E8F0; padding: 22px 32px; text-align: center; font-size: 15px; color: #64748B;">
            You received this email because this client website is part of your SitePulse reporting workflow.
            <a href="${baseUrl}/dashboard/settings" style="color: ${accent}; text-decoration: none; margin-left: 4px;">Manage email settings</a>
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
