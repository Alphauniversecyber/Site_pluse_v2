import { apiError, apiSuccess, requireApiUser } from "@/lib/api";
import { buildWebsiteScanPlainEnglish } from "@/lib/report-ai";
import type { ScanResult } from "@/types";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const { supabase, profile, errorResponse } = await requireApiUser();
  if (errorResponse || !profile) {
    return errorResponse;
  }

  const { data: scan, error } = await supabase
    .from("scan_results")
    .select("*")
    .eq("id", params.id)
    .single<ScanResult>();

  if (error || !scan) {
    return apiError(error?.message ?? "Scan not found.", 404);
  }

  try {
    const detail = await buildWebsiteScanPlainEnglish({
      scan,
      profile,
      websiteId: scan.website_id
    });

    return apiSuccess(detail);
  } catch (routeError) {
    console.error("[scan/plain-language] failed", {
      scanId: params.id,
      message: routeError instanceof Error ? routeError.message : "Unknown error"
    });

    return apiError("Unable to analyze this scan right now.", 500);
  }
}
