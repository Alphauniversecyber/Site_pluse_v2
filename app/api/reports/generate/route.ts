import { apiError, apiSuccess, requireApiUser } from "@/lib/api";
import { generateAndStoreReport, generateAndStoreReportPdf } from "@/lib/report-service";
import { canAccessFeature } from "@/lib/trial";
import { reportGenerationSchema } from "@/lib/validation";
import { resolveWorkspaceContext } from "@/lib/workspace";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { supabase, profile, errorResponse } = await requireApiUser();
  if (errorResponse || !profile) {
    return errorResponse;
  }

  const wantsPdf = request.headers.get("accept")?.includes("application/pdf") ?? false;

  const workspace = await resolveWorkspaceContext(profile);

  if (!canAccessFeature(workspace.workspaceProfile, "download_report")) {
    return apiError("Upgrade to keep generating PDF reports.", 403);
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
    if (wantsPdf) {
      const { pdfBuffer } = await generateAndStoreReportPdf(parsed.data);

      return new Response(pdfBuffer, {
        status: 201,
        headers: {
          "Content-Type": "application/pdf",
          "Cache-Control": "no-store"
        }
      });
    }

    const report = await generateAndStoreReport(parsed.data);
    return apiSuccess(report, 201);
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Unable to generate report.", 500);
  }
}
