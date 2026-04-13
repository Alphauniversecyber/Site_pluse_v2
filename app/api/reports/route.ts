import { apiError, apiSuccess, requireApiUser } from "@/lib/api";

export async function GET() {
  const { supabase, errorResponse } = await requireApiUser();
  if (errorResponse) {
    return errorResponse;
  }

  const { data: reports, error } = await supabase
    .from("reports")
    .select("id,website_id,scan_id,pdf_url,sent_to_email,sent_at,created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return apiError(error.message, 500);
  }

  return apiSuccess(reports ?? []);
}
