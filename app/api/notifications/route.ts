import { apiError, apiSuccess, requireApiUser } from "@/lib/api";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { canManageWorkspace, resolveWorkspaceContext } from "@/lib/workspace";

export const runtime = "nodejs";

export async function DELETE() {
  const { user, profile, errorResponse } = await requireApiUser();
  if (errorResponse || !profile || !user) {
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
      .delete()
      .eq("user_id", workspace.workspaceOwnerId)
      .select("id");

    if (error) {
      console.error("[api:notifications] clear failed", {
        userId: workspace.workspaceOwnerId,
        error: error.message
      });

      return apiError(error.message, 500);
    }

    const cleared = data?.length ?? 0;

    console.info("[api:notifications] cleared", {
      userId: workspace.workspaceOwnerId,
      cleared
    });

    return apiSuccess({ cleared });
  } catch (error) {
    console.error("[api:notifications] unexpected clear error", {
      userId: workspace.workspaceOwnerId,
      error: error instanceof Error ? error.message : "Unable to clear notifications."
    });

    return apiError(error instanceof Error ? error.message : "Unable to clear notifications.", 500);
  }
}
