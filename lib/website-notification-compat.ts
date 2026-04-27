import type { ReportFrequency } from "@/types";

type WebsiteRowLike = Record<string, unknown>;

export function isMissingWebsiteNotificationColumnsError(message: string | null | undefined) {
  const normalized = (message ?? "").toLowerCase();
  return (
    normalized.includes("auto_email_reports") ||
    normalized.includes("report_frequency") ||
    normalized.includes("extra_recipients") ||
    normalized.includes("email_notifications")
  );
}

export function normalizeWebsiteNotificationFields<T extends WebsiteRowLike>(website: T): T {
  const legacyEnabled =
    typeof website.email_reports_enabled === "boolean" ? website.email_reports_enabled : undefined;
  const legacyFrequency =
    typeof website.email_report_frequency === "string" ? website.email_report_frequency : undefined;

  return {
    ...website,
    report_frequency:
      typeof website.report_frequency === "string"
        ? website.report_frequency
        : legacyEnabled === false
          ? "never"
          : (legacyFrequency ?? "weekly"),
    extra_recipients: Array.isArray(website.extra_recipients)
      ? website.extra_recipients
      : Array.isArray(website.report_recipients)
        ? website.report_recipients
        : [],
    auto_email_reports:
      typeof website.auto_email_reports === "boolean"
        ? website.auto_email_reports
        : (legacyEnabled ?? true),
    email_notifications:
      typeof website.email_notifications === "boolean"
        ? website.email_notifications
        : true
  } as T;
}

export function buildLegacyWebsiteNotificationPayload(input: {
  reportFrequency?: ReportFrequency;
  autoEmailReports?: boolean;
  extraRecipients?: string[];
}) {
  const legacy: Record<string, unknown> = {};

  if (input.reportFrequency !== undefined) {
    if (input.reportFrequency === "never") {
      legacy.email_reports_enabled = false;
      legacy.email_report_frequency = "weekly";
    } else {
      legacy.email_report_frequency = input.reportFrequency;
    }
  }

  if (input.autoEmailReports !== undefined) {
    legacy.email_reports_enabled =
      input.reportFrequency === "never" ? false : input.autoEmailReports;
  }

  if (input.extraRecipients !== undefined) {
    legacy.report_recipients = input.extraRecipients;
  }

  return legacy;
}
