import "server-only";

import type {
  AgencyBranding,
  Report,
  ScanResult,
  ScanSchedule,
  UserProfile,
  Website
} from "@/types";
import { generateScanPdf } from "@/lib/pdf";
import { sendCriticalAlertEmail, sendReportEmail } from "@/lib/resend";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { PLAN_LIMITS, buildStoragePath } from "@/lib/utils";

async function loadReportContext(websiteId: string, scanId: string) {
  const admin = createSupabaseAdminClient();

  const { data: website } = await admin.from("websites").select("*").eq("id", websiteId).single<Website>();
  if (!website) {
    throw new Error("Website not found.");
  }

  const { data: scan } = await admin
    .from("scan_results")
    .select("*")
    .eq("id", scanId)
    .eq("website_id", websiteId)
    .single<ScanResult>();

  if (!scan) {
    throw new Error("Scan result not found.");
  }

  const { data: profile } = await admin.from("users").select("*").eq("id", website.user_id).single<UserProfile>();
  if (!profile) {
    throw new Error("User profile not found.");
  }

  const { data: branding } = await admin
    .from("agency_branding")
    .select("*")
    .eq("user_id", profile.id)
    .maybeSingle<AgencyBranding>();

  const { data: schedule } = await admin
    .from("scan_schedules")
    .select("*")
    .eq("website_id", website.id)
    .maybeSingle<ScanSchedule>();

  const { data: history } = await admin
    .from("scan_results")
    .select("*")
    .eq("website_id", website.id)
    .lte("scanned_at", scan.scanned_at)
    .order("scanned_at", { ascending: false })
    .limit(8);

  const historyRows = ((history ?? []) as ScanResult[]).reverse();
  const previousScan =
    historyRows.length > 1 ? historyRows[historyRows.length - 2] : null;

  return {
    website,
    scan,
    profile,
    branding: branding ?? null,
    history: historyRows,
    previousScan,
    schedule: schedule ?? null
  };
}

function getRecipients(profile: UserProfile, website: Website, explicitEmail?: string) {
  if (explicitEmail) {
    return [explicitEmail];
  }

  const recipients = [
    profile.email,
    ...(profile.extra_report_recipients ?? []),
    ...(website.report_recipients ?? [])
  ].filter(Boolean);

  return Array.from(new Set(recipients));
}

export async function generateAndStoreReport(input: { websiteId: string; scanId: string }) {
  const admin = createSupabaseAdminClient();
  const { website, scan, profile, branding, history, previousScan, schedule } = await loadReportContext(
    input.websiteId,
    input.scanId
  );

  if (!PLAN_LIMITS[profile.plan].pdfReports) {
    throw new Error("Your current plan does not include PDF reports.");
  }

  const pdfBuffer = await generateScanPdf({
    website,
    scan,
    branding,
    history,
    previousScan,
    profile,
    schedule
  });

  const storagePath = buildStoragePath(
    website.user_id,
    `${website.label.replace(/\s+/g, "-").toLowerCase()}-${scan.id}.pdf`
  );

  const { error: uploadError } = await admin.storage.from("reports").upload(storagePath, pdfBuffer, {
    contentType: "application/pdf",
    upsert: true
  });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data: existing } = await admin
    .from("reports")
    .select("*")
    .eq("website_id", website.id)
    .eq("scan_id", scan.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    const { data: updated, error } = await admin
      .from("reports")
      .update({
        pdf_url: storagePath
      })
      .eq("id", existing.id)
      .select("*")
      .single();

    if (error || !updated) {
      throw new Error(error?.message ?? "Unable to update report record.");
    }

    return updated as Report;
  }

  const { data: report, error } = await admin
    .from("reports")
    .insert({
      website_id: website.id,
      scan_id: scan.id,
      pdf_url: storagePath
    })
    .select("*")
    .single();

  if (error || !report) {
    throw new Error(error?.message ?? "Unable to create report.");
  }

  return report as Report;
}

export async function getSignedReportUrl(reportId: string) {
  const admin = createSupabaseAdminClient();

  const { data: report } = await admin.from("reports").select("*").eq("id", reportId).single<Report>();
  if (!report) {
    throw new Error("Report not found.");
  }

  const { data, error } = await admin.storage.from("reports").createSignedUrl(report.pdf_url, 900);
  if (error || !data) {
    throw new Error(error?.message ?? "Unable to sign report URL.");
  }

  return {
    report,
    signedUrl: data.signedUrl
  };
}

export async function sendStoredReportEmail(input: { reportId: string; email?: string }) {
  const admin = createSupabaseAdminClient();

  const { data: report } = await admin.from("reports").select("*").eq("id", input.reportId).single<Report>();
  if (!report) {
    throw new Error("Report not found.");
  }

  const { website, scan, profile, branding } = await loadReportContext(report.website_id, report.scan_id);
  const { data: previousRows } = await admin
    .from("scan_results")
    .select("*")
    .eq("website_id", website.id)
    .lt("scanned_at", scan.scanned_at)
    .order("scanned_at", { ascending: false })
    .limit(1);

  const recipients = getRecipients(profile, website, input.email);
  if (!recipients.length) {
    throw new Error("No report recipients configured.");
  }

  const { data: file, error: downloadError } = await admin.storage.from("reports").download(report.pdf_url);
  if (downloadError || !file) {
    throw new Error(downloadError?.message ?? "Unable to download report.");
  }

  const pdfBuffer = Buffer.from(await file.arrayBuffer());

  for (const recipient of recipients) {
    await sendReportEmail({
      to: recipient,
      website,
      branding,
      scan,
      previousScan: (previousRows?.[0] as ScanResult | undefined) ?? null,
      pdfBuffer
    });
  }

  const { data: updated, error } = await admin
    .from("reports")
    .update({
      sent_to_email: recipients.join(", "),
      sent_at: new Date().toISOString()
    })
    .eq("id", report.id)
    .select("*")
    .single();

  if (error || !updated) {
    throw new Error(error?.message ?? "Unable to update report delivery status.");
  }

  await admin.from("notifications").insert({
    user_id: website.user_id,
    website_id: website.id,
    type: "report_ready",
    title: `Report sent for ${website.label}`,
    body: `Weekly report sent to ${recipients.join(", ")}.`,
    severity: "low",
    metadata: {
      reportId: report.id
    }
  });

  return updated as Report;
}

function isDue(lastSentAt: string | null, frequency: UserProfile["email_report_frequency"]) {
  if (!lastSentAt) {
    return true;
  }

  const diff = Date.now() - new Date(lastSentAt).getTime();
  const threshold =
    frequency === "daily"
      ? 24 * 60 * 60 * 1000
      : frequency === "weekly"
        ? 7 * 24 * 60 * 60 * 1000
        : 30 * 24 * 60 * 60 * 1000;

  return diff >= threshold;
}

export async function processDueEmailReports(limit = 20) {
  const admin = createSupabaseAdminClient();
  const { data: users } = await admin
    .from("users")
    .select("*")
    .eq("email_reports_enabled", true)
    .in("plan", ["starter", "agency"])
    .limit(limit);

  const sent: string[] = [];

  for (const profile of (users ?? []) as UserProfile[]) {
    const { data: websites } = await admin
      .from("websites")
      .select("*")
      .eq("user_id", profile.id)
      .eq("is_active", true)
      .eq("email_reports_enabled", true);

    for (const website of (websites ?? []) as Website[]) {
      const { data: latestRows } = await admin
        .from("scan_results")
        .select("*")
        .eq("website_id", website.id)
        .order("scanned_at", { ascending: false })
        .limit(1);

      const latestScan = (latestRows?.[0] as ScanResult | undefined) ?? null;
      if (!latestScan || latestScan.scan_status === "failed") {
        if (profile.email_notifications_enabled) {
          await sendCriticalAlertEmail({
            to: profile.email,
            website,
            scan:
              latestScan ??
              ({
                performance_score: 0,
                seo_score: 0,
                accessibility_score: 0,
                best_practices_score: 0,
                issues: [],
                recommendations: [],
                raw_data: {},
                scanned_at: new Date().toISOString()
              } as unknown as ScanResult),
            reason: "A scheduled report could not be sent because the latest scan failed."
          });
        }

        continue;
      }

      const { data: lastReport } = await admin
        .from("reports")
        .select("sent_at")
        .eq("website_id", website.id)
        .order("sent_at", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();

      if (!isDue(lastReport?.sent_at ?? null, profile.email_report_frequency)) {
        continue;
      }

      const report = await generateAndStoreReport({
        websiteId: website.id,
        scanId: latestScan.id
      });

      await sendStoredReportEmail({
        reportId: report.id
      });

      sent.push(report.id);
    }
  }

  return sent;
}
