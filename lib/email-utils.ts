import type { EmailTemplateId, ScanFrequency } from "@/types";

export function buildEmailDedupeKey(...parts: Array<string | number | null | undefined>) {
  return parts
    .filter((value): value is string | number => value !== null && value !== undefined && value !== "")
    .map((value) =>
      String(value)
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-")
    )
    .join(":");
}

export function normalizeIssueKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function escapeHtml(value: string | number | null | undefined) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function getReportEmailMeta(input: {
  deliveryMode: "manual" | "scheduled";
  frequency: ScanFrequency;
}): {
  templateId: EmailTemplateId;
  campaign: string;
  label: "Manual" | "Daily" | "Weekly" | "Monthly";
} {
  if (input.deliveryMode === "manual") {
    return {
      templateId: "report_manual",
      campaign: "report_manual",
      label: "Manual"
    };
  }

  if (input.frequency === "monthly") {
    return {
      templateId: "report_monthly",
      campaign: "report_monthly",
      label: "Monthly"
    };
  }

  if (input.frequency === "daily") {
    return {
      templateId: "report_weekly",
      campaign: "report_daily",
      label: "Daily"
    };
  }

  return {
    templateId: "report_weekly",
    campaign: "report_weekly",
    label: "Weekly"
  };
}
