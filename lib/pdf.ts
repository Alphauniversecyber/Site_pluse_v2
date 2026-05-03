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
import { renderAiReportPdf as renderBrowserPdf } from "@/lib/report-browser-pdf";
import { renderAiReportPdf as renderStructuredPdf } from "@/lib/report-pdf-renderer";

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
  try {
    return await renderBrowserPdf(input);
  } catch (error) {
    // TODO: Consolidate the jsPDF fallback onto renderReportHtml so both PDF paths share one layout source of truth.
    console.warn("[reports:pdf] Browser PDF renderer failed. Falling back to jsPDF renderer.", {
      websiteId: input.website.id,
      scanId: input.scan.id,
      error: error instanceof Error ? error.message : "Unknown PDF rendering error"
    });

    return renderStructuredPdf(input);
  }
}
