import { apiError, apiSuccess, requireApiUser } from "@/lib/api";
import { getFriendlyScanFailureMessage } from "@/lib/scan-errors";
import { executeWebsiteScan } from "@/lib/scan-service";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { scanRunSchema } from "@/lib/validation";
import { canManageWorkspace, resolveWorkspaceContext } from "@/lib/workspace";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { profile, errorResponse } = await requireApiUser();
  if (errorResponse || !profile) {
    return errorResponse;
  }
  const workspace = await resolveWorkspaceContext(profile);
  if (!canManageWorkspace(workspace)) {
    return apiError("Viewer access is read-only.", 403);
  }
  const admin = createSupabaseAdminClient();

  const body = await request.json().catch(() => null);
  const parsed = scanRunSchema.safeParse(body);

  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid scan payload.", 422);
  }

  const { data: website } = await admin
    .from("websites")
    .select("id")
    .eq("user_id", workspace.workspaceOwnerId)
    .eq("id", parsed.data.websiteId)
    .single();

  if (!website) {
    return apiError("Website not found.", 404);
  }

  try {
    if (parsed.data.activateSite) {
      const { error: websiteUpdateError } = await admin
        .from("websites")
        .update({
          is_active: true,
          failure_reason: null
        })
        .eq("id", parsed.data.websiteId)
        .eq("user_id", workspace.workspaceOwnerId);

      if (websiteUpdateError) {
        return apiError(websiteUpdateError.message, 500);
      }
    }

    const result = await executeWebsiteScan(parsed.data.websiteId, {
      forceHealthSignals: true,
      source: "manual"
    });
    return apiSuccess(result);
  } catch (error) {
    return apiError(getFriendlyScanFailureMessage(error instanceof Error ? error.message : "Scan failed."), 500);
  }
}
