import { apiError, apiSuccess, requireApiUser } from "@/lib/api";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const { supabase, errorResponse } = await requireApiUser();
  if (errorResponse) {
    return errorResponse;
  }

  const { data: scan, error } = await supabase
    .from("scan_results")
    .select("*")
    .eq("id", params.id)
    .single();

  if (error || !scan) {
    return apiError(error?.message ?? "Scan not found.", 404);
  }

  return apiSuccess(scan);
}
