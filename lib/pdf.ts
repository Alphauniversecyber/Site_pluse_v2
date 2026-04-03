import "server-only";

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
import { renderAiReportPdf } from "@/lib/report-browser-pdf";

export async function generateScanPdf(input: {
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
}) {
  return renderAiReportPdf(input);
}
