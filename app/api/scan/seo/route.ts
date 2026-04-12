import { apiError, apiSuccess, requireApiUser } from "@/lib/api";
import { ensureSeoAudit } from "@/lib/seo-audit";
import { seoScanSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { supabase, errorResponse } = await requireApiUser();
  if (errorResponse) {
    return errorResponse;
  }

  const body = await request.json().catch(() => null);
  const parsed = seoScanSchema.safeParse(body);

  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid SEO audit payload.", 422);
  }

  const { data: website } = await supabase
    .from("websites")
    .select("id, url")
    .eq("id", parsed.data.websiteId)
    .single<{ id: string; url: string }>();

  if (!website) {
    return apiError("Website not found.", 404);
  }

  if (!parsed.data.scanId) {
    return apiError("A scan id is required to generate an SEO audit.", 422);
  }

  try {
    const record = await ensureSeoAudit({
      websiteId: website.id,
      scanId: parsed.data.scanId,
      url: website.url,
      force: parsed.data.force
    });

    return apiSuccess(record);
  } catch (error) {
    console.error("[api:scan:seo] Failed to generate SEO audit.", {
      websiteId: website.id,
      scanId: parsed.data.scanId,
      force: parsed.data.force ?? false,
      error: error instanceof Error ? error.message : "Unknown SEO audit error."
    });
    return apiError(error instanceof Error ? error.message : "Unable to complete SEO audit.", 500);
  }
}
