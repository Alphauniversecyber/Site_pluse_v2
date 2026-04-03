import "server-only";

import type { AgencyBranding, ScanResult, ScanSchedule, UserProfile, Website } from "@/types";
import { renderAiReportPdf } from "@/lib/report-pdf-renderer";

export async function generateScanPdf(input: {
  website: Website;
  scan: ScanResult;
  history: ScanResult[];
  previousScan: ScanResult | null;
  branding?: AgencyBranding | null;
  profile: UserProfile;
  schedule?: ScanSchedule | null;
}) {
  return renderAiReportPdf(input);
}
