import { apiError, apiSuccess, requireApiUser } from "@/lib/api";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { resolveWorkspaceContext } from "@/lib/workspace";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const { profile, errorResponse } = await requireApiUser();
  if (errorResponse || !profile) {
    return errorResponse;
  }
  const workspace = await resolveWorkspaceContext(profile);
  const admin = createSupabaseAdminClient();

  const { data: website } = await admin
    .from("websites")
    .select("id")
    .eq("id", params.id)
    .eq("user_id", workspace.workspaceOwnerId)
    .maybeSingle();

  if (!website) {
    return apiError("Website not found.", 404);
  }

  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get("page") ?? "1");
  const pageSize = Number(searchParams.get("pageSize") ?? "10");
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data: scans, error, count } = await admin
    .from("scan_results")
    .select(
      "id,website_id,performance_score,seo_score,accessibility_score,best_practices_score,accessibility_violations,scanned_at",
      { count: "exact" }
    )
    .eq("website_id", params.id)
    .order("scanned_at", { ascending: false })
    .range(from, to);

  if (error) {
    return apiError(error.message, 500);
  }

  return apiSuccess({
    scans: scans ?? [],
    total: count ?? 0,
    page,
    pageSize
  });
}
