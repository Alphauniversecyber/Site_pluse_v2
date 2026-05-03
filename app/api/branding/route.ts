import { apiError, apiSuccess, requireApiUser } from "@/lib/api";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { isTrialActive } from "@/lib/trial";
import { brandingSchema } from "@/lib/validation";
import { canManageWorkspace, resolveWorkspaceContext } from "@/lib/workspace";

export async function GET() {
  const { supabase, profile, errorResponse } = await requireApiUser();
  if (errorResponse || !profile) {
    return errorResponse;
  }

  const workspace = await resolveWorkspaceContext(profile);

  const { data: branding, error } = await supabase
    .from("agency_branding")
    .select("*")
    .eq("user_id", workspace.workspaceOwnerId)
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

  const workspace = await resolveWorkspaceContext(profile);
  if (!canManageWorkspace(workspace)) {
    return apiError("Viewer access is read-only.", 403);
  }

  if (workspace.workspaceProfile.plan !== "agency" && !isTrialActive(workspace.workspaceProfile)) {
    return apiError("White-label branding is available on the Agency plan.", 403);
  }

  const body = await request.json().catch(() => null);
  const parsed = brandingSchema.safeParse(body);

  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid branding payload.", 422);
  }

  const admin = createSupabaseAdminClient();
  const { data: branding, error } = await admin
    .from("agency_branding")
    .upsert(
      {
        user_id: workspace.workspaceOwnerId,
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
