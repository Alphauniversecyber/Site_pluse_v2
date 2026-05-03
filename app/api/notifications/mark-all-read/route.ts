import { apiError, apiSuccess, requireApiUser } from "@/lib/api";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { canManageWorkspace, resolveWorkspaceContext } from "@/lib/workspace";

export const runtime = "nodejs";

export async function PATCH() {
  const { profile, errorResponse } = await requireApiUser();
  if (errorResponse || !profile) {
    return errorResponse;
  }

  const workspace = await resolveWorkspaceContext(profile);
  if (!canManageWorkspace(workspace)) {
    return apiError("Viewer access is read-only.", 403);
  }

  const admin = createSupabaseAdminClient();

  try {
    const { data, error } = await admin
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", workspace.workspaceOwnerId)
      .eq("is_read", false)
      .select("id");

    if (error) {
      console.error("[api:notifications:mark-all-read] failed", {
        userId: workspace.workspaceOwnerId,
        error: error.message
      });

      return apiError(error.message, 500);
    }

    return apiSuccess({ updated: data?.length ?? 0 });
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Unable to mark notifications as read.", 500);
  }
}
