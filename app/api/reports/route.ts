import { apiError, apiSuccess, requireApiUser } from "@/lib/api";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { resolveWorkspaceContext } from "@/lib/workspace";

export async function GET() {
  const { profile, errorResponse } = await requireApiUser();
  if (errorResponse || !profile) {
    return errorResponse;
  }
  const workspace = await resolveWorkspaceContext(profile);
  const admin = createSupabaseAdminClient();
  const { data: websites, error: websitesError } = await admin
    .from("websites")
    .select("id")
    .eq("user_id", workspace.workspaceOwnerId);

  if (websitesError) {
    return apiError(websitesError.message, 500);
  }

  const websiteIds = (websites ?? []).map((website) => website.id);
  if (!websiteIds.length) {
    return apiSuccess([]);
  }

  const { data: reports, error } = await admin
    .from("reports")
    .select("id,website_id,scan_id,pdf_url,sent_to_email,sent_at,created_at")
    .in("website_id", websiteIds)
    .order("created_at", { ascending: false });

  if (error) {
    return apiError(error.message, 500);
  }

  return apiSuccess(reports ?? []);
}
