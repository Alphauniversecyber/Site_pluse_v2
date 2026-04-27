import "server-only";

import type { UserProfile } from "@/types";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type WorkspaceMembership = {
  owner_user_id: string;
  member_user_id: string | null;
  role: "owner" | "admin" | "viewer";
  status: "invited" | "active";
};

export type WorkspaceContext = {
  actorProfile: UserProfile;
  workspaceOwnerId: string;
  workspaceProfile: UserProfile;
  membership: WorkspaceMembership | null;
  isTeamMember: boolean;
};

export async function resolveWorkspaceContext(actorProfile: UserProfile): Promise<WorkspaceContext> {
  const admin = createSupabaseAdminClient();

  const { data: membership } = await admin
    .from("team_members")
    .select("owner_user_id,member_user_id,role,status")
    .eq("member_user_id", actorProfile.id)
    .eq("status", "active")
    .order("invited_at", { ascending: false })
    .limit(1)
    .maybeSingle<WorkspaceMembership>();

  const workspaceOwnerId = membership?.owner_user_id ?? actorProfile.id;

  if (workspaceOwnerId === actorProfile.id) {
    return {
      actorProfile,
      workspaceOwnerId,
      workspaceProfile: actorProfile,
      membership: membership ?? null,
      isTeamMember: false
    };
  }

  const { data: workspaceProfile } = await admin
    .from("users")
    .select("*")
    .eq("id", workspaceOwnerId)
    .maybeSingle<UserProfile>();

  return {
    actorProfile,
    workspaceOwnerId,
    workspaceProfile: workspaceProfile ?? actorProfile,
    membership: membership ?? null,
    isTeamMember: true
  };
}

export async function syncWorkspaceWebsiteOwnership(input: {
  workspaceOwnerId: string;
  actorUserId: string;
}) {
  const admin = createSupabaseAdminClient();
  const memberIds = new Set<string>();

  if (input.actorUserId !== input.workspaceOwnerId) {
    memberIds.add(input.actorUserId);
  } else {
    const { data: members } = await admin
      .from("team_members")
      .select("member_user_id")
      .eq("owner_user_id", input.workspaceOwnerId)
      .eq("status", "active");

    for (const row of members ?? []) {
      if (typeof row.member_user_id === "string" && row.member_user_id !== input.workspaceOwnerId) {
        memberIds.add(row.member_user_id);
      }
    }
  }

  const candidateUserIds = Array.from(memberIds);
  if (!candidateUserIds.length) {
    return { movedCount: 0 };
  }

  const { data: websites, error } = await admin
    .from("websites")
    .select("id,user_id,url")
    .in("user_id", [input.workspaceOwnerId, ...candidateUserIds]);

  if (error || !websites?.length) {
    return { movedCount: 0 };
  }

  const ownerUrls = new Set(
    websites
      .filter((website) => website.user_id === input.workspaceOwnerId)
      .map((website) => website.url)
  );

  const transferableIds = websites
    .filter((website) => website.user_id !== input.workspaceOwnerId)
    .filter((website) => !ownerUrls.has(website.url))
    .map((website) => website.id);

  if (!transferableIds.length) {
    return { movedCount: 0 };
  }

  const { error: updateError } = await admin
    .from("websites")
    .update({
      user_id: input.workspaceOwnerId,
      updated_at: new Date().toISOString()
    })
    .in("id", transferableIds);

  if (updateError) {
    throw new Error(updateError.message);
  }

  return { movedCount: transferableIds.length };
}
