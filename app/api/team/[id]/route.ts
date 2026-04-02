import { apiError, apiSuccess, requireApiUser } from "@/lib/api";

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const { supabase, profile, errorResponse } = await requireApiUser();
  if (errorResponse || !profile) {
    return errorResponse;
  }

  const { error } = await supabase
    .from("team_members")
    .delete()
    .eq("id", params.id)
    .eq("owner_user_id", profile.id);

  if (error) {
    return apiError(error.message, 500);
  }

  return apiSuccess({ success: true });
}
