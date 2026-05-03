import { apiError, apiSuccess, requireApiUser } from "@/lib/api";
import { ensureBrokenLinkCheck } from "@/lib/broken-links";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { linkScanSchema } from "@/lib/validation";
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
  const parsed = linkScanSchema.safeParse(body);

  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid link scan payload.", 422);
  }

  const { data: website } = await admin
    .from("websites")
    .select("id, url")
    .eq("user_id", workspace.workspaceOwnerId)
    .eq("id", parsed.data.websiteId)
    .single<{ id: string; url: string }>();

  if (!website) {
    return apiError("Website not found.", 404);
  }

  try {
    const record = await ensureBrokenLinkCheck({
      websiteId: website.id,
      url: website.url,
      scanId: parsed.data.scanId,
      force: parsed.data.force
    });

    return apiSuccess(record);
  } catch (error) {
    console.error("[api:scan:links] Failed to generate link health data.", {
      websiteId: website.id,
      scanId: parsed.data.scanId ?? null,
      force: parsed.data.force ?? false,
      error: error instanceof Error ? error.message : "Unknown broken link error."
    });
    return apiError(error instanceof Error ? error.message : "Unable to complete link scan.", 500);
  }
}
