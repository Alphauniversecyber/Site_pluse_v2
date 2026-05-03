import { apiError, apiSuccess, requireApiUser } from "@/lib/api";
import { getSignedReportUrl } from "@/lib/report-service";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { canAccessFeature } from "@/lib/trial";
import { resolveWorkspaceContext } from "@/lib/workspace";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const { profile, errorResponse } = await requireApiUser();
  if (errorResponse || !profile) {
    return errorResponse;
  }

  const workspace = await resolveWorkspaceContext(profile);
  const admin = createSupabaseAdminClient();

  if (!canAccessFeature(workspace.workspaceProfile, "download_report")) {
    return apiError("Upgrade to keep downloading PDF reports.", 403);
  }

  const { data: websites, error: websitesError } = await admin
    .from("websites")
    .select("id")
    .eq("user_id", workspace.workspaceOwnerId);

  if (websitesError) {
    return apiError(websitesError.message, 500);
  }

  const websiteIds = (websites ?? []).map((website) => website.id);
  if (!websiteIds.length) {
    return apiError("Report not found.", 404);
  }

  const { data: report } = await admin
    .from("reports")
    .select("id")
    .in("website_id", websiteIds)
    .eq("id", params.id)
    .single();

  if (!report) {
    return apiError("Report not found.", 404);
  }

  try {
    const result = await getSignedReportUrl(params.id);
    return apiSuccess(result);
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Unable to fetch report.", 500);
  }
}
