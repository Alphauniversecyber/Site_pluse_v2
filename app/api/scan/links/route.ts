import { apiError, apiSuccess, requireApiUser } from "@/lib/api";
import { ensureBrokenLinkCheck } from "@/lib/broken-links";
import { linkScanSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { supabase, errorResponse } = await requireApiUser();
  if (errorResponse) {
    return errorResponse;
  }

  const body = await request.json().catch(() => null);
  const parsed = linkScanSchema.safeParse(body);

  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid link scan payload.", 422);
  }

  const { data: website } = await supabase
    .from("websites")
    .select("id, url")
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
    return apiError(error instanceof Error ? error.message : "Unable to complete link scan.", 500);
  }
}
