import "server-only";

import { cookies } from "next/headers";

import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import type { UserProfile, WorkspaceRole, WorkspaceSummary } from "@/types";

export const ACTIVE_WORKSPACE_COOKIE = "sitepulse-active-workspace";

type WorkspaceMembership = {
  id: string;
  owner_user_id: string;
  member_user_id: string | null;
  member_email: string;
  role: "owner" | "admin" | "viewer";
  status: "invited" | "active";
  joined_at?: string | null;
};

export type WorkspaceContext = {
  actorProfile: UserProfile;
  workspaceOwnerId: string;
  workspaceProfile: UserProfile;
  membership: WorkspaceMembership | null;
  isTeamMember: boolean;
  isOwner: boolean;
  role: WorkspaceRole;
  activeWorkspace: WorkspaceSummary;
  availableWorkspaces: WorkspaceSummary[];
};

function getWorkspaceName(profile: Pick<UserProfile, "full_name" | "email">) {
  return profile.full_name?.trim() || profile.email;
}

function buildOwnWorkspaceSummary(profile: UserProfile): WorkspaceSummary {
  return {
    ownerUserId: profile.id,
    name: getWorkspaceName(profile),
    email: profile.email,
    role: "owner",
    isOwner: true,
    plan: profile.plan,
    isTrial: profile.is_trial,
    trialEndsAt: profile.trial_ends_at
  };
}

function deriveWorkspaceRole(membership: WorkspaceMembership | null): WorkspaceRole {
  if (!membership) {
    return "owner";
  }

  return membership.role === "admin" ? "admin" : "viewer";
}

async function loadWorkspaceMemberships(actorUserId: string) {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("team_members")
    .select("id,owner_user_id,member_user_id,member_email,role,status,joined_at")
    .eq("member_user_id", actorUserId)
    .eq("status", "active")
    .order("joined_at", { ascending: false, nullsFirst: false });

  return (data ?? []) as WorkspaceMembership[];
}

async function loadWorkspaceProfiles(ownerIds: string[]) {
  if (!ownerIds.length) {
    return new Map<string, UserProfile>();
  }

  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("users")
    .select("*")
    .in("id", ownerIds);

  return new Map(((data ?? []) as UserProfile[]).map((profile) => [profile.id, profile]));
}

function getSelectedWorkspaceOwnerId(actorUserId: string, memberships: WorkspaceMembership[]) {
  const cookieValue = cookies().get(ACTIVE_WORKSPACE_COOKIE)?.value ?? null;
  if (cookieValue === actorUserId) {
    return actorUserId;
  }

  if (cookieValue && memberships.some((membership) => membership.owner_user_id === cookieValue)) {
    return cookieValue;
  }

  return actorUserId;
}

export async function listAvailableWorkspaces(actorProfile: UserProfile, memberships?: WorkspaceMembership[]) {
  const activeMemberships = memberships ?? (await loadWorkspaceMemberships(actorProfile.id));
  const ownerIds = Array.from(new Set(activeMemberships.map((membership) => membership.owner_user_id)));
  const profilesById = await loadWorkspaceProfiles(ownerIds);

  const workspaces: WorkspaceSummary[] = [buildOwnWorkspaceSummary(actorProfile)];

  for (const membership of activeMemberships) {
    const ownerProfile = profilesById.get(membership.owner_user_id);
    if (!ownerProfile) {
      continue;
    }

    workspaces.push({
      ownerUserId: ownerProfile.id,
      name: getWorkspaceName(ownerProfile),
      email: ownerProfile.email,
      role: membership.role === "admin" ? "admin" : "viewer",
      isOwner: false,
      plan: ownerProfile.plan,
      isTrial: ownerProfile.is_trial,
      trialEndsAt: ownerProfile.trial_ends_at
    });
  }

  return workspaces;
}

export async function resolveWorkspaceContext(actorProfile: UserProfile): Promise<WorkspaceContext> {
  const memberships = await loadWorkspaceMemberships(actorProfile.id);
  const availableWorkspaces = await listAvailableWorkspaces(actorProfile, memberships);
  const selectedOwnerId = getSelectedWorkspaceOwnerId(actorProfile.id, memberships);
  const membership = memberships.find((item) => item.owner_user_id === selectedOwnerId) ?? null;
  const workspaceOwnerId = membership?.owner_user_id ?? actorProfile.id;
  const role = deriveWorkspaceRole(membership);
  const isOwner = workspaceOwnerId === actorProfile.id;

  if (isOwner) {
    const activeWorkspace =
      availableWorkspaces.find((workspace) => workspace.ownerUserId === actorProfile.id) ??
      buildOwnWorkspaceSummary(actorProfile);

    return {
      actorProfile,
      workspaceOwnerId,
      workspaceProfile: actorProfile,
      membership,
      isTeamMember: false,
      isOwner: true,
      role,
      activeWorkspace,
      availableWorkspaces
    };
  }

  const profilesById = await loadWorkspaceProfiles([workspaceOwnerId]);
  const workspaceProfile = profilesById.get(workspaceOwnerId) ?? actorProfile;
  const activeWorkspace =
    availableWorkspaces.find((workspace) => workspace.ownerUserId === workspaceOwnerId) ?? {
      ownerUserId: workspaceProfile.id,
      name: getWorkspaceName(workspaceProfile),
      email: workspaceProfile.email,
      role,
      isOwner: false,
      plan: workspaceProfile.plan,
      isTrial: workspaceProfile.is_trial,
      trialEndsAt: workspaceProfile.trial_ends_at
    };

  return {
    actorProfile,
    workspaceOwnerId,
    workspaceProfile,
    membership,
    isTeamMember: true,
    isOwner: false,
    role,
    activeWorkspace,
    availableWorkspaces
  };
}

export function canManageWorkspace(workspace: Pick<WorkspaceContext, "role">) {
  return workspace.role === "owner" || workspace.role === "admin";
}

export function canAccessWorkspaceBilling(workspace: Pick<WorkspaceContext, "isOwner">) {
  return workspace.isOwner;
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
