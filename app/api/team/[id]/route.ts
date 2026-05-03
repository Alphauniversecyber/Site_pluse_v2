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

  const { data: invite, error: inviteLookupError } = await admin
    .from("team_invites")
    .select("id")
    .eq("id", params.id)
    .eq("workspace_owner_id", workspace.workspaceOwnerId)
    .eq("status", "pending")
    .maybeSingle();

  if (inviteLookupError) {
    return apiError(inviteLookupError.message, 500);
  }

  if (invite) {
    const { error: inviteDeleteError } = await admin
      .from("team_invites")
      .delete()
      .eq("id", params.id)
      .eq("workspace_owner_id", workspace.workspaceOwnerId)
      .eq("status", "pending");

    if (inviteDeleteError) {
      return apiError(inviteDeleteError.message, 500);
    }

    return apiSuccess({ success: true, type: "invite" });
  }

  const { error: memberDeleteError } = await admin
    .from("team_members")
    .delete()
    .eq("id", params.id)
    .eq("owner_user_id", workspace.workspaceOwnerId);

  if (memberDeleteError) {
    return apiError(memberDeleteError.message, 500);
  }

  return apiSuccess({ success: true, type: "member" });
}
