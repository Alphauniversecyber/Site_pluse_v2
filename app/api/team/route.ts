import { apiError, apiSuccess, requireApiUser } from "@/lib/api";
import { PLAN_LIMITS } from "@/lib/utils";
import { teamMemberSchema } from "@/lib/validation";

export async function GET() {
  const { supabase, profile, errorResponse } = await requireApiUser();
  if (errorResponse || !profile) {
    return errorResponse;
  }

  const { data: members, error } = await supabase
    .from("team_members")
    .select("*")
    .eq("owner_user_id", profile.id)
    .order("invited_at", { ascending: false });

  if (error) {
    return apiError(error.message, 500);
  }

  return apiSuccess(members ?? []);
}

export async function POST(request: Request) {
  const { supabase, profile, errorResponse } = await requireApiUser();
  if (errorResponse || !profile) {
    return errorResponse;
  }

  if (profile.plan !== "agency") {
    return apiError("Team access is available on the Agency plan.", 403);
  }

  const body = await request.json().catch(() => null);
  const parsed = teamMemberSchema.safeParse(body);

  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid team member payload.", 422);
  }

  const { count } = await supabase
    .from("team_members")
    .select("*", { count: "exact", head: true })
    .eq("owner_user_id", profile.id);

  if ((count ?? 0) >= PLAN_LIMITS.agency.teamMembers - 1) {
    return apiError("Agency plan allows up to 3 users total, including you.", 403);
  }

  const { data: member, error } = await supabase
    .from("team_members")
    .insert({
      owner_user_id: profile.id,
      member_email: parsed.data.member_email,
      role: parsed.data.role
    })
    .select("*")
    .single();

  if (error || !member) {
    return apiError(error?.message ?? "Unable to invite team member.", 500);
  }

  return apiSuccess(member, 201);
}
