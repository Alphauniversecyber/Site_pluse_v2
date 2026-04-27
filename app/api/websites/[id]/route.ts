import { apiError, apiSuccess, requireApiUser } from "@/lib/api";
import { buildHealthScore } from "@/lib/health-score";
import { PLAN_LIMITS } from "@/lib/utils";
import { websiteUpdateSchema } from "@/lib/validation";
import {
  buildLegacyWebsiteNotificationPayload,
  isMissingWebsiteNotificationColumnsError,
  normalizeWebsiteNotificationFields
} from "@/lib/website-notification-compat";
import { resolveWorkspaceContext } from "@/lib/workspace";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const { supabase, errorResponse } = await requireApiUser();
  if (errorResponse) {
    return errorResponse;
  }

  const [{ data: website, error }, { data: schedule }, { data: scans }, { data: sslCheck }, { data: securityHeaders }, { data: seoAudit }, { data: cruxData }, { data: brokenLinks }, { data: uptimeChecks }, { data: competitorScans }] = await Promise.all([
    supabase.from("websites").select("*").eq("id", params.id).single(),
    supabase.from("scan_schedules").select("*").eq("website_id", params.id).maybeSingle(),
    supabase
      .from("scan_results")
      .select("*")
      .eq("website_id", params.id)
      .order("scanned_at", { ascending: false })
      .limit(10),
    supabase
      .from("ssl_checks")
      .select("*")
      .eq("website_id", params.id)
      .order("checked_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("security_headers")
      .select("*")
      .eq("website_id", params.id)
      .order("checked_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("seo_audit")
      .select("*")
      .eq("website_id", params.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("crux_data")
      .select("*")
      .eq("website_id", params.id)
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("broken_links")
      .select("*")
      .eq("website_id", params.id)
      .order("scanned_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("uptime_checks")
      .select("*")
      .eq("website_id", params.id)
      .order("checked_at", { ascending: false })
      .limit(120),
    supabase
      .from("competitor_scans")
      .select("*")
      .eq("website_id", params.id)
      .order("scanned_at", { ascending: false })
      .limit(30)
  ]);

  if (error || !website) {
    return apiError(error?.message ?? "Website not found.", 404);
  }

  return apiSuccess({
    ...normalizeWebsiteNotificationFields(website),
    schedule: schedule ?? null,
    scans: scans ?? [],
    ssl_check: sslCheck ?? null,
    security_headers: securityHeaders ?? null,
    seo_audit: seoAudit ?? null,
    crux_data: cruxData ?? null,
    broken_links: brokenLinks ?? null,
    uptime_checks: uptimeChecks ?? [],
    competitor_scans: competitorScans ?? [],
    health_score: buildHealthScore({
      scan: (scans ?? [])[0] ?? null,
      seoAudit: seoAudit ?? null,
      sslCheck: sslCheck ?? null,
      securityHeaders: securityHeaders ?? null,
      uptimeChecks: uptimeChecks ?? []
    })
  });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const { supabase, profile, errorResponse } = await requireApiUser();
  if (errorResponse || !profile) {
    return errorResponse;
  }

  const workspace = await resolveWorkspaceContext(profile);

  const body = await request.json().catch(() => null);
  const parsed = websiteUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid update payload.", 422);
  }

  if (
    parsed.data.frequency &&
    !PLAN_LIMITS[workspace.workspaceProfile.plan].scanFrequencies.includes(parsed.data.frequency)
  ) {
    return apiError("That scan frequency is not available on your current plan.", 403);
  }

  const websiteUpdates: Record<string, unknown> = {};
  if (parsed.data.label !== undefined) {
    websiteUpdates.label = parsed.data.label;
  }
  if (parsed.data.is_active !== undefined) {
    websiteUpdates.is_active = parsed.data.is_active;
  }
  if (parsed.data.report_frequency !== undefined) {
    websiteUpdates.report_frequency = parsed.data.report_frequency;
  }
  if (parsed.data.extra_recipients !== undefined) {
    websiteUpdates.extra_recipients = parsed.data.extra_recipients;
  }
  if (parsed.data.auto_email_reports !== undefined) {
    websiteUpdates.auto_email_reports = parsed.data.auto_email_reports;
  }
  if (parsed.data.email_notifications !== undefined) {
    websiteUpdates.email_notifications = parsed.data.email_notifications;
  }
  if (parsed.data.competitor_urls !== undefined) {
    websiteUpdates.competitor_urls = parsed.data.competitor_urls.slice(0, 3);
  }

  let updateResult = await supabase
    .from("websites")
    .update(websiteUpdates)
    .eq("id", params.id)
    .select("*")
    .single();

  if (
    updateResult.error &&
    isMissingWebsiteNotificationColumnsError(updateResult.error.message)
  ) {
    const legacyUpdates = {
      ...(parsed.data.label !== undefined ? { label: parsed.data.label } : {}),
      ...(parsed.data.is_active !== undefined ? { is_active: parsed.data.is_active } : {}),
      ...buildLegacyWebsiteNotificationPayload({
        reportFrequency: parsed.data.report_frequency,
        autoEmailReports: parsed.data.auto_email_reports,
        extraRecipients: parsed.data.extra_recipients
      }),
      ...(parsed.data.competitor_urls !== undefined
        ? { competitor_urls: parsed.data.competitor_urls.slice(0, 3) }
        : {})
    };

    updateResult = await supabase
      .from("websites")
      .update(legacyUpdates)
      .eq("id", params.id)
      .select("*")
      .single();
  }

  const website = updateResult.data ? normalizeWebsiteNotificationFields(updateResult.data) : null;

  if (updateResult.error || !website) {
    return apiError(updateResult.error?.message ?? "Unable to update website.", 500);
  }

  if (parsed.data.frequency) {
    await supabase
      .from("scan_schedules")
      .upsert({
        website_id: params.id,
        frequency: parsed.data.frequency,
        next_scan_at: new Date().toISOString()
      })
      .select("*");
  }

  return apiSuccess(website);
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const { supabase, errorResponse } = await requireApiUser();
  if (errorResponse) {
    return errorResponse;
  }

  const { error } = await supabase.from("websites").delete().eq("id", params.id);

  if (error) {
    return apiError(error.message, 500);
  }

  return apiSuccess({ success: true });
}
