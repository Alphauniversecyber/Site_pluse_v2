import { apiError, apiSuccess, requireApiUser } from "@/lib/api";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { normalizeTeamEmail, sendWorkspaceInviteEmail } from "@/lib/team-access";
import { PLAN_LIMITS } from "@/lib/utils";
import { teamInviteSchema } from "@/lib/validation";
import { resolveWorkspaceContext } from "@/lib/workspace";
import type { TeamInvite } from "@/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { profile, errorResponse } = await requireApiUser();
  if (errorResponse || !profile) {
    return errorResponse;
  }

  const workspace = await resolveWorkspaceContext(profile);
  if (!workspace.isOwner) {
    return apiError("Only the workspace owner can manage team access.", 403);
  }

  if (PLAN_LIMITS[workspace.workspaceProfile.plan].teamMembers <= 1) {
    return apiError("Team access is available on the Agency plan.", 403);
  }

  const body = await request.json().catch(() => null);
  const parsed = teamInviteSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid invite payload.", 422);
  }

  const email = normalizeTeamEmail(parsed.data.email);
  if (email === normalizeTeamEmail(workspace.workspaceProfile.email)) {
    return apiError("You already own this workspace.", 422);
  }

  const admin = createSupabaseAdminClient();
  const [{ count: memberCount, error: memberCountError }, { count: inviteCount, error: inviteCountError }] =
    await Promise.all([
      admin
        .from("team_members")
        .select("*", { count: "exact", head: true })
        .eq("owner_user_id", workspace.workspaceOwnerId)
        .eq("status", "active"),
      admin
        .from("team_invites")
        .select("*", { count: "exact", head: true })
        .eq("workspace_owner_id", workspace.workspaceOwnerId)
        .eq("status", "pending")
    ]);

  if (memberCountError || inviteCountError) {
    return apiError(memberCountError?.message ?? inviteCountError?.message ?? "Unable to check team seats.", 500);
  }

  const seatUsage = 1 + (memberCount ?? 0) + (inviteCount ?? 0);
  if (seatUsage >= PLAN_LIMITS[workspace.workspaceProfile.plan].teamMembers) {
    return apiError("Team member limit reached for your plan", 403);
  }

  const [{ data: existingInvite, error: existingInviteError }, { data: existingMember, error: existingMemberError }] =
    await Promise.all([
      admin
        .from("team_invites")
        .select("id")
        .eq("workspace_owner_id", workspace.workspaceOwnerId)
        .eq("invited_email", email)
        .eq("status", "pending")
        .maybeSingle(),
      admin
        .from("team_members")
        .select("id")
        .eq("owner_user_id", workspace.workspaceOwnerId)
        .eq("member_email", email)
        .eq("status", "active")
        .maybeSingle()
    ]);

  if (existingInviteError || existingMemberError) {
    return apiError(existingInviteError?.message ?? existingMemberError?.message ?? "Unable to validate invite.", 500);
  }

  if (existingInvite) {
    return apiError("That teammate already has a pending invite.", 409);
  }

  if (existingMember) {
    return apiError("That teammate is already an active member.", 409);
  }

  const token = crypto.randomUUID();
  const { data: invite, error: inviteError } = await admin
    .from("team_invites")
    .insert({
      workspace_owner_id: workspace.workspaceOwnerId,
      invited_email: email,
      role: parsed.data.role,
      token,
      status: "pending"
    })
    .select("*")
    .single<TeamInvite>();

  if (inviteError || !invite) {
    return apiError(inviteError?.message ?? "Unable to create the invite.", 500);
  }

  try {
    await sendWorkspaceInviteEmail({
      ownerProfile: workspace.workspaceProfile,
      invitedEmail: email,
      role: parsed.data.role,
      token
    });
  } catch (error) {
    await admin.from("team_invites").delete().eq("id", invite.id);
    return apiError(error instanceof Error ? error.message : "Unable to send the invite email.", 500);
  }

  return apiSuccess(
    {
      id: invite.id,
      email: invite.invited_email,
      name: null,
      role: invite.role,
      type: "invite",
      status: "invited",
      joinedAt: null,
      createdAt: invite.created_at
    },
    201
  );
}
