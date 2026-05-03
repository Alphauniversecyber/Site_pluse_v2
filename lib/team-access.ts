import "server-only";

import { buildEmailDedupeKey, escapeHtml } from "@/lib/email-utils";
import { sendProductEmail } from "@/lib/resend";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getBaseUrl } from "@/lib/utils";
import type { TeamAccessEntry, TeamInvite, UserProfile } from "@/types";

type TeamMemberRow = {
  id: string;
  owner_user_id: string;
  member_email: string;
  member_user_id: string | null;
  role: "admin" | "viewer";
  status: "invited" | "active";
  joined_at: string | null;
};

type UserLookup = Pick<UserProfile, "id" | "email" | "full_name">;

export function normalizeTeamEmail(email: string) {
  return email.trim().toLowerCase();
}

export function getWorkspaceOwnerName(profile: Pick<UserProfile, "full_name" | "email">) {
  return profile.full_name?.trim() || profile.email;
}

function getRoleLabel(role: "admin" | "viewer") {
  return role === "admin" ? "Admin" : "Viewer";
}

function ensureHttpsBaseUrl() {
  return getBaseUrl().replace(/^http:\/\//i, "https://").replace(/\/$/, "");
}

async function loadUserByEmail(email: string) {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("users")
    .select("id,email,full_name")
    .ilike("email", email)
    .maybeSingle<UserLookup>();

  return data ?? null;
}

async function upsertAcceptedTeamMember(input: {
  ownerUserId: string;
  memberUserId: string;
  memberEmail: string;
  role: "admin" | "viewer";
}) {
  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();

  const { data, error } = await admin
    .from("team_members")
    .upsert(
      {
        owner_user_id: input.ownerUserId,
        member_email: input.memberEmail,
        member_user_id: input.memberUserId,
        role: input.role,
        status: "active",
        joined_at: now
      },
      {
        onConflict: "owner_user_id,member_email"
      }
    )
    .select("id,owner_user_id,member_email,member_user_id,role,status,joined_at")
    .single<TeamMemberRow>();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to save the team membership.");
  }

  return data;
}

export async function sendWorkspaceInviteEmail(input: {
  ownerProfile: Pick<UserProfile, "id" | "email" | "full_name">;
  invitedEmail: string;
  role: "admin" | "viewer";
  token: string;
}) {
  const ownerName = getWorkspaceOwnerName(input.ownerProfile);
  const roleLabel = getRoleLabel(input.role);
  const baseUrl = ensureHttpsBaseUrl();
  const acceptUrl = `${baseUrl}/api/team/invite/accept?token=${encodeURIComponent(input.token)}`;
  const declineUrl = `${baseUrl}/api/team/invite/decline?token=${encodeURIComponent(input.token)}`;

  return sendProductEmail({
    templateId: "team_invite",
    dedupeKey: buildEmailDedupeKey("team-invite", input.ownerProfile.id, input.invitedEmail, input.token),
    campaign: "team_access",
    to: input.invitedEmail,
    subject: `${ownerName} invited you to their SitePulse workspace`,
    preheader: `You've been invited to join SitePulse as a ${roleLabel}.`,
    eyebrow: "Workspace invite",
    title: `Join ${ownerName} on SitePulse`,
    summary: `You were invited to join their workspace as a ${roleLabel}. Accept the invite to start working inside the shared dashboard.`,
    bodyHtml: `
      <p style="margin:0 0 14px 0;font-size:15px;line-height:24px;color:#475569;">
        ${escapeHtml(ownerName)} invited you to collaborate inside SitePulse as a <strong>${escapeHtml(roleLabel)}</strong>.
      </p>
      <p style="margin:0 0 18px 0;font-size:15px;line-height:24px;color:#475569;">
        ${input.role === "admin"
          ? "Admins can manage websites, scans, reports, settings, and branding, but billing stays with the workspace owner."
          : "Viewers can review websites, scans, and reports with read-only access."}
      </p>
      <p style="margin:0;font-size:14px;line-height:22px;color:#64748B;">
        If you do not already have a SitePulse account, accepting the invite will walk you through signup first.
      </p>
    `,
    ctaLabel: "Accept Invitation",
    ctaUrl: acceptUrl,
    secondaryLabel: "Decline",
    secondaryUrl: declineUrl,
    details: [
      { label: "Invited by", value: ownerName },
      { label: "Role", value: roleLabel }
    ],
    metadata: {
      ownerUserId: input.ownerProfile.id,
      invitedEmail: input.invitedEmail,
      role: input.role,
      inviteToken: input.token
    }
  });
}

export async function autoAcceptPendingInvitesForUser(input: {
  userId: string;
  email: string;
}) {
  const admin = createSupabaseAdminClient();
  const normalizedEmail = normalizeTeamEmail(input.email);
  const { data: invites, error } = await admin
    .from("team_invites")
    .select("*")
    .eq("invited_email", normalizedEmail)
    .eq("status", "pending");

  if (error) {
    throw new Error(error.message);
  }

  const acceptedOwnerIds = new Set<string>();
  for (const invite of (invites ?? []) as TeamInvite[]) {
    await upsertAcceptedTeamMember({
      ownerUserId: invite.workspace_owner_id,
      memberUserId: input.userId,
      memberEmail: normalizedEmail,
      role: invite.role
    });

    const { error: updateError } = await admin
      .from("team_invites")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString()
      })
      .eq("id", invite.id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    acceptedOwnerIds.add(invite.workspace_owner_id);
  }

  return Array.from(acceptedOwnerIds);
}

export async function acceptPendingInviteByToken(token: string) {
  const admin = createSupabaseAdminClient();
  const { data: invite, error } = await admin
    .from("team_invites")
    .select("*")
    .eq("token", token)
    .maybeSingle<TeamInvite>();

  if (error) {
    throw new Error(error.message);
  }

  if (!invite || invite.status !== "pending") {
    return {
      invite: null,
      user: null,
      member: null
    };
  }

  const user = await loadUserByEmail(invite.invited_email);
  if (!user) {
    return {
      invite,
      user: null,
      member: null
    };
  }

  const member = await upsertAcceptedTeamMember({
    ownerUserId: invite.workspace_owner_id,
    memberUserId: user.id,
    memberEmail: invite.invited_email,
    role: invite.role
  });

  const { error: updateError } = await admin
    .from("team_invites")
    .update({
      status: "accepted",
      accepted_at: new Date().toISOString()
    })
    .eq("id", invite.id);

  if (updateError) {
    throw new Error(updateError.message);
  }

  return {
    invite,
    user,
    member
  };
}

export async function declinePendingInviteByToken(token: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("team_invites")
    .update({
      status: "declined"
    })
    .eq("token", token)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data);
}

export async function getTeamAccessEntries(workspaceOwnerId: string) {
  const admin = createSupabaseAdminClient();
  const [{ data: members, error: membersError }, { data: invites, error: invitesError }] = await Promise.all([
    admin
      .from("team_members")
      .select("id,owner_user_id,member_email,member_user_id,role,status,joined_at")
      .eq("owner_user_id", workspaceOwnerId)
      .eq("status", "active")
      .order("joined_at", { ascending: false, nullsFirst: false }),
    admin
      .from("team_invites")
      .select("*")
      .eq("workspace_owner_id", workspaceOwnerId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
  ]);

  if (membersError) {
    throw new Error(membersError.message);
  }

  if (invitesError) {
    throw new Error(invitesError.message);
  }

  const userIds = (members ?? [])
    .map((member) => member.member_user_id)
    .filter((value): value is string => typeof value === "string");
  const profilesById = await loadWorkspaceProfilesByIds(userIds);

  const memberEntries: TeamAccessEntry[] = ((members ?? []) as TeamMemberRow[]).map((member) => {
    const profile = member.member_user_id ? profilesById.get(member.member_user_id) ?? null : null;

    return {
      id: member.id,
      email: member.member_email,
      name: profile?.full_name ?? null,
      role: member.role,
      type: "member",
      status: "active",
      joinedAt: member.joined_at,
      createdAt: null
    };
  });

  const inviteEntries: TeamAccessEntry[] = ((invites ?? []) as TeamInvite[]).map((invite) => ({
    id: invite.id,
    email: invite.invited_email,
    name: null,
    role: invite.role,
    type: "invite",
    status: "invited",
    joinedAt: null,
    createdAt: invite.created_at
  }));

  return [...inviteEntries, ...memberEntries];
}

async function loadWorkspaceProfilesByIds(userIds: string[]) {
  if (!userIds.length) {
    return new Map<string, UserLookup>();
  }

  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("users")
    .select("id,email,full_name")
    .in("id", userIds);

  return new Map(((data ?? []) as UserLookup[]).map((profile) => [profile.id, profile]));
}
