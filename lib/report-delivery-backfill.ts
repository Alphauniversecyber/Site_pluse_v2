import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const REPORT_TEMPLATE_IDS = ["report_weekly", "report_monthly", "report_manual"] as const;

export async function backfillScheduledReportDeliveries(limit = 250) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("email_logs")
    .select("id,template_id,campaign,metadata,sent_at,to_email,status")
    .eq("status", "sent")
    .in("template_id", [...REPORT_TEMPLATE_IDS])
    .order("sent_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  let updatedCount = 0;

  for (const row of (data ?? []) as Array<{
    id: string;
    template_id: string | null;
    campaign: string | null;
    metadata: Record<string, unknown> | null;
    sent_at: string;
    to_email: string;
    status: string;
  }>) {
    if ((row.campaign ?? "").startsWith("report_") === false) {
      continue;
    }

    const reportId = typeof row.metadata?.reportId === "string" ? row.metadata.reportId : null;
    if (!reportId) {
      continue;
    }

    const { data: report, error: reportError } = await admin
      .from("reports")
      .select("id,sent_to_email,sent_at")
      .eq("id", reportId)
      .maybeSingle<{ id: string; sent_to_email: string | null; sent_at: string | null }>();

    if (reportError) {
      throw new Error(reportError.message);
    }

    if (!report) {
      continue;
    }

    const recipients = new Set(
      (report.sent_to_email ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    );
    const alreadyHadRecipient = recipients.has(row.to_email);
    recipients.add(row.to_email);

    const nextSentAt =
      report.sent_at && new Date(report.sent_at).getTime() <= new Date(row.sent_at).getTime()
        ? report.sent_at
        : row.sent_at;

    const shouldUpdate =
      !report.sent_at ||
      !alreadyHadRecipient ||
      (report.sent_to_email ?? "") !== Array.from(recipients).join(", ");

    if (!shouldUpdate) {
      continue;
    }

    const { error: updateError } = await admin
      .from("reports")
      .update({
        sent_to_email: Array.from(recipients).join(", "),
        sent_at: nextSentAt
      })
      .eq("id", report.id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    updatedCount += 1;
  }

  return {
    updatedCount
  };
}
