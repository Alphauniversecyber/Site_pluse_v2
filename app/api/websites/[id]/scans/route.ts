import { apiError, apiSuccess, requireApiUser } from "@/lib/api";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const { supabase, errorResponse } = await requireApiUser();
  if (errorResponse) {
    return errorResponse;
  }

  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get("page") ?? "1");
  const pageSize = Number(searchParams.get("pageSize") ?? "10");
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data: scans, error, count } = await supabase
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
