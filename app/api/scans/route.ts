import { apiError, apiSuccess, requireApiUserFromRequest } from "@/lib/api";
import { executeWebsiteScan } from "@/lib/scan-service";
import { PLAN_LIMITS, normalizeUrl } from "@/lib/utils";
import { authenticatedScanSchema } from "@/lib/validation";
import {
  buildLegacyWebsiteNotificationPayload,
  isMissingWebsiteNotificationColumnsError
} from "@/lib/website-notification-compat";
import { resolveWorkspaceContext } from "@/lib/workspace";

function deriveWebsiteLabel(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
  }
}

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { supabase, profile, errorResponse } = await requireApiUserFromRequest(request);
  if (errorResponse || !profile) {
    return errorResponse;
  }

  const workspace = await resolveWorkspaceContext(profile);

  const body = await request.json().catch(() => null);
  const parsed = authenticatedScanSchema.safeParse(body);

  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid scan request.", 422);
  }

  const normalizedUrl = normalizeUrl(parsed.data.url);

  const { data: existingWebsite } = await supabase
    .from("websites")
    .select("*")
    .eq("user_id", workspace.workspaceOwnerId)
    .eq("url", normalizedUrl)
    .maybeSingle();

  let website = existingWebsite;

  if (!website) {
    const { count, error: countError } = await supabase
      .from("websites")
      .select("*", { count: "exact", head: true })
      .eq("user_id", workspace.workspaceOwnerId);

    if (countError) {
      return apiError(countError.message, 500);
    }

    if ((count ?? 0) >= PLAN_LIMITS[workspace.workspaceProfile.plan].websiteLimit) {
      return apiError(`Your ${PLAN_LIMITS[workspace.workspaceProfile.plan].name} plan limit has been reached.`, 403);
    }

    const defaultFrequency = PLAN_LIMITS[workspace.workspaceProfile.plan].scanFrequencies[0];
    let createWebsiteResult = await supabase
      .from("websites")
      .insert({
        user_id: workspace.workspaceOwnerId,
        url: normalizedUrl,
        label: deriveWebsiteLabel(normalizedUrl),
        report_frequency: "weekly",
        extra_recipients: [],
        auto_email_reports: true,
        email_notifications: true,
        competitor_urls: []
      })
      .select("*")
      .single();

    if (
      createWebsiteResult.error &&
      isMissingWebsiteNotificationColumnsError(createWebsiteResult.error.message)
    ) {
      createWebsiteResult = await supabase
        .from("websites")
        .insert({
          user_id: workspace.workspaceOwnerId,
          url: normalizedUrl,
          label: deriveWebsiteLabel(normalizedUrl),
          ...buildLegacyWebsiteNotificationPayload({
            reportFrequency: "weekly",
            autoEmailReports: true,
            extraRecipients: []
          }),
          competitor_urls: []
        })
        .select("*")
        .single();
    }

    const createdWebsite = createWebsiteResult.data;
    const createWebsiteError = createWebsiteResult.error;

    if (createWebsiteError || !createdWebsite) {
      return apiError(createWebsiteError?.message ?? "Unable to create website for scan.", 500);
    }

    website = createdWebsite;

    const { error: scheduleError } = await supabase.from("scan_schedules").insert({
      website_id: website.id,
      frequency: defaultFrequency,
      next_scan_at: new Date().toISOString()
    });

    if (scheduleError) {
      return apiError(scheduleError.message, 500);
    }
  }

  try {
    const result = await executeWebsiteScan(website.id, {
      forceHealthSignals: true
    });

    return apiSuccess(
      {
        scanId: result.scan.id,
        websiteId: website.id
      },
      201
    );
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Unable to save scan.", 500);
  }
}
