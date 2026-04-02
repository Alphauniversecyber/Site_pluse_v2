import { apiError, apiSuccess, requireApiUser } from "@/lib/api";
import { getFriendlyScanFailureMessage } from "@/lib/scan-errors";
import { executeWebsiteScan } from "@/lib/scan-service";
import { scanRunSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { supabase, errorResponse } = await requireApiUser();
  if (errorResponse) {
    return errorResponse;
  }

  const body = await request.json().catch(() => null);
  const parsed = scanRunSchema.safeParse(body);

  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid scan payload.", 422);
  }

  const { data: website } = await supabase
    .from("websites")
    .select("id")
    .eq("id", parsed.data.websiteId)
    .single();

  if (!website) {
    return apiError("Website not found.", 404);
  }

  try {
    const result = await executeWebsiteScan(parsed.data.websiteId);
    return apiSuccess(result);
  } catch (error) {
    return apiError(getFriendlyScanFailureMessage(error instanceof Error ? error.message : "Scan failed."), 500);
  }
}
