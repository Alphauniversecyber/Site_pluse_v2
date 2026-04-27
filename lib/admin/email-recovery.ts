import "server-only";

import type { ScanResult, Website } from "@/types";
import { executeWebsiteScan } from "@/lib/scan-service";
import { generateAndStoreReport, sendStoredReportEmail } from "@/lib/report-service";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

async function loadActiveWebsite(websiteId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("websites")
    .select("id,user_id,url,label,is_active,auto_email_reports,report_frequency,extra_recipients,email_notifications")
    .eq("id", websiteId)
    .maybeSingle<Website>();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Website not found.");
  }

  if (!data.is_active) {
    throw new Error("This website is inactive. Reactivate it before running admin recovery actions.");
  }

  return data;
}

async function loadLatestSuccessfulScan(websiteId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("scan_results")
    .select("id,website_id,scan_status,scanned_at")
    .eq("website_id", websiteId)
    .eq("scan_status", "success")
    .order("scanned_at", { ascending: false })
    .limit(1)
    .maybeSingle<Pick<ScanResult, "id" | "website_id" | "scan_status" | "scanned_at">>();

  if (error) {
    throw new Error(error.message);
  }

  return data ?? null;
}

export async function runAdminWebsiteScan(websiteId: string) {
  const website = await loadActiveWebsite(websiteId);
  const result = await executeWebsiteScan(websiteId, {
    forceHealthSignals: true
  });

  return {
    website,
    scan: result.scan
  };
}

export async function sendAdminWebsiteReport(websiteId: string) {
  const website = await loadActiveWebsite(websiteId);
  const latestSuccessfulScan = await loadLatestSuccessfulScan(websiteId);

  if (!latestSuccessfulScan) {
    throw new Error("No successful scan is available for this website yet. Run a scan first.");
  }

  const report = await generateAndStoreReport({
    websiteId,
    scanId: latestSuccessfulScan.id
  });

  const delivery = await sendStoredReportEmail({
    reportId: report.id,
    skipAlreadySentRecipients: false,
    deliveryMode: "manual"
  });

  return {
    website,
    report,
    delivery
  };
}
