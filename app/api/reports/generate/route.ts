import { apiError, apiSuccess, requireApiUser } from "@/lib/api";
import { generateAndStoreReport } from "@/lib/report-service";
import { reportGenerationSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { supabase, errorResponse } = await requireApiUser();
  if (errorResponse) {
    return errorResponse;
  }

  const body = await request.json().catch(() => null);
  const parsed = reportGenerationSchema.safeParse(body);

  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid report request.", 422);
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
    const report = await generateAndStoreReport(parsed.data);
    return apiSuccess(report, 201);
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Unable to generate report.", 500);
  }
}
