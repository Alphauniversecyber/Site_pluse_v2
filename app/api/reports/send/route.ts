import { apiError, apiSuccess, requireApiUser } from "@/lib/api";
import { sendStoredReportEmail } from "@/lib/report-service";
import { reportSendSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { supabase, errorResponse } = await requireApiUser();
  if (errorResponse) {
    return errorResponse;
  }

  const body = await request.json().catch(() => null);
  const parsed = reportSendSchema.safeParse(body);

  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid send request.", 422);
  }

  const { data: report } = await supabase
    .from("reports")
    .select("id")
    .eq("id", parsed.data.reportId)
    .single();

  if (!report) {
    return apiError("Report not found.", 404);
  }

  try {
    const result = await sendStoredReportEmail({
      reportId: parsed.data.reportId,
      email: parsed.data.email
    });
    return apiSuccess(result);
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Unable to send report.", 500);
  }
}
