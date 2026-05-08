import type { ReportFrequency, ScanFrequency } from "@/types";
import { formatDateTime } from "@/lib/utils";

type ReportCadence = ReportFrequency | ScanFrequency | null | undefined;

export function getReportFrequencyLabel(frequency: ReportCadence) {
  if (frequency === "daily") {
    return "Daily";
  }

  if (frequency === "monthly") {
    return "Monthly";
  }

  if (frequency === "weekly") {
    return "Weekly";
  }

  return "Website";
}

export function getReportTitle(frequency: ReportCadence) {
  const label = getReportFrequencyLabel(frequency);
  return label === "Website" ? "Website Report" : `${label} Website Report`;
}

export function getNextReportDate(anchorValue: Date | string, frequency: ReportCadence) {
  if (frequency === "never") {
    return "Not scheduled";
  }

  const anchor = typeof anchorValue === "string" ? new Date(anchorValue) : new Date(anchorValue);

  if (frequency === "daily") {
    anchor.setDate(anchor.getDate() + 1);
  } else if (frequency === "monthly") {
    anchor.setMonth(anchor.getMonth() + 1);
  } else {
    anchor.setDate(anchor.getDate() + 7);
  }

  return formatDateTime(anchor);
}
