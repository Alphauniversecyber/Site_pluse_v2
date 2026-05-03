import { apiError, apiSuccess, requireApiUser } from "@/lib/api";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { canManageWorkspace, resolveWorkspaceContext } from "@/lib/workspace";

export const runtime = "nodejs";

export async function PATCH(_: Request, { params }: { params: { id: string } }) {
  const { profile, errorResponse } = await requireApiUser();
  if (errorResponse || !profile) {
    return errorResponse;
  }

  const workspace = await resolveWorkspaceContext(profile);
  if (!canManageWorkspace(workspace)) {
    return apiError("Viewer access is read-only.", 403);
  }

  const admin = createSupabaseAdminClient();

  const { data: notification } = await admin
    .from("notifications")
    .select("id")
    .eq("id", params.id)
    .eq("user_id", workspace.workspaceOwnerId)
    .maybeSingle();

  if (!notification) {
    return apiError("Notification not found.", 404);
  }

  const { data, error } = await admin
    .from("notifications")
    .update({ is_read: true })
    .eq("id", params.id)
    .eq("user_id", workspace.workspaceOwnerId)
    .select("id,user_id,website_id,type,title,body,is_read,severity,metadata,created_at")
    .single();

  if (error || !data) {
    return apiError(error?.message ?? "Unable to update notification.", 500);
  }

  return apiSuccess(data);
}
