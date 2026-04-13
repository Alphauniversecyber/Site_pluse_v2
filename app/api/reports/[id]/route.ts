import { apiError, apiSuccess, requireApiUser } from "@/lib/api";
import { getSignedReportUrl } from "@/lib/report-service";
import { canAccessFeature } from "@/lib/trial";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const { supabase, profile, errorResponse } = await requireApiUser();
  if (errorResponse || !profile) {
    return errorResponse;
  }

  if (!canAccessFeature(profile, "download_report")) {
    return apiError("Upgrade to keep downloading PDF reports.", 403);
  }

  const { data: report } = await supabase
    .from("reports")
    .select("id")
    .eq("id", params.id)
    .single();

  if (!report) {
    return apiError("Report not found.", 404);
  }

  try {
    const result = await getSignedReportUrl(params.id);
    return apiSuccess(result);
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Unable to fetch report.", 500);
  }
}
