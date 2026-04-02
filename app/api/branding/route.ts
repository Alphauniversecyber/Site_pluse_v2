import { apiError, apiSuccess, requireApiUser } from "@/lib/api";
import { brandingSchema } from "@/lib/validation";

export async function GET() {
  const { supabase, profile, errorResponse } = await requireApiUser();
  if (errorResponse || !profile) {
    return errorResponse;
  }

  const { data: branding, error } = await supabase
    .from("agency_branding")
    .select("*")
    .eq("user_id", profile.id)
    .maybeSingle();

  if (error) {
    return apiError(error.message, 500);
  }

  return apiSuccess(branding);
}

export async function PUT(request: Request) {
  const { supabase, profile, errorResponse } = await requireApiUser();
  if (errorResponse || !profile) {
    return errorResponse;
  }

  if (profile.plan !== "agency") {
    return apiError("White-label branding is available on the Agency plan.", 403);
  }

  const body = await request.json().catch(() => null);
  const parsed = brandingSchema.safeParse(body);

  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid branding payload.", 422);
  }

  const { data: branding, error } = await supabase
    .from("agency_branding")
    .upsert(
      {
        user_id: profile.id,
        ...parsed.data
      },
      {
        onConflict: "user_id"
      }
    )
    .select("*")
    .single();

  if (error || !branding) {
    return apiError(error?.message ?? "Unable to update branding.", 500);
  }

  return apiSuccess(branding);
}
