import { apiError, apiSuccess, requireApiUser } from "@/lib/api";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { resolveWorkspaceContext } from "@/lib/workspace";

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const { profile, errorResponse } = await requireApiUser();
  if (errorResponse || !profile) {
    return errorResponse;
  }

  const workspace = await resolveWorkspaceContext(profile);
  if (!workspace.isOwner) {
    return apiError("Only the workspace owner can manage team access.", 403);
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("team_members")
    .delete()
    .eq("id", params.id)
    .eq("owner_user_id", workspace.workspaceOwnerId);

  if (error) {
    return apiError(error.message, 500);
  }

  return apiSuccess({ success: true });
}
