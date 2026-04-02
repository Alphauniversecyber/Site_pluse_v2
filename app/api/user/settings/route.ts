import { apiError, apiSuccess, requireApiUser } from "@/lib/api";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { settingsSchema } from "@/lib/validation";

export async function GET() {
  const { profile, errorResponse } = await requireApiUser();
  if (errorResponse || !profile) {
    return errorResponse;
  }

  return apiSuccess(profile);
}

export async function PUT(request: Request) {
  const { supabase, user, profile, errorResponse } = await requireApiUser();
  if (errorResponse || !profile || !user) {
    return errorResponse;
  }

  const body = await request.json().catch(() => null);
  const parsed = settingsSchema.safeParse(body);

  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid settings payload.", 422);
  }

  const { password, email, ...profileUpdates } = parsed.data;

  if (email !== profile.email) {
    const { error } = await supabase.auth.updateUser({
      email
    });

    if (error) {
      return apiError(error.message, 400);
    }
  }

  if (password) {
    const { error } = await supabase.auth.updateUser({
      password
    });

    if (error) {
      return apiError(error.message, 400);
    }
  }

  const { data: updatedProfile, error } = await supabase
    .from("users")
    .update({
      ...profileUpdates,
      email
    })
    .eq("id", profile.id)
    .select("*")
    .single();

  if (error || !updatedProfile) {
    return apiError(error?.message ?? "Unable to update settings.", 500);
  }

  return apiSuccess(updatedProfile);
}

export async function DELETE() {
  const { user, errorResponse } = await requireApiUser();
  if (errorResponse || !user) {
    return errorResponse;
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin.auth.admin.deleteUser(user.id);

  if (error) {
    return apiError(error.message, 500);
  }

  return apiSuccess({ success: true });
}
