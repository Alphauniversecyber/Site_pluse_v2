import { apiError, apiSuccess, requireApiUser } from "@/lib/api";
import { sendStoredReportEmail } from "@/lib/report-service";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { reportSendSchema } from "@/lib/validation";
import { canManageWorkspace, resolveWorkspaceContext } from "@/lib/workspace";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { user, profile, errorResponse } = await requireApiUser();
  if (errorResponse || !profile) {
    return errorResponse;
  }
  const workspace = await resolveWorkspaceContext(profile);
  if (!canManageWorkspace(workspace)) {
    return apiError("Viewer access is read-only.", 403);
  }
  const admin = createSupabaseAdminClient();

  const body = await request.json().catch(() => null);
  const parsed = reportSendSchema.safeParse(body);

  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid send request.", 422);
  }

  const { data: websites, error: websitesError } = await admin
    .from("websites")
    .select("id")
    .eq("user_id", workspace.workspaceOwnerId);

  if (websitesError) {
    return apiError(websitesError.message, 500);
  }

  const websiteIds = (websites ?? []).map((website) => website.id);
  if (!websiteIds.length) {
    return apiError("Report not found.", 404);
  }

  const { data: report } = await admin
    .from("reports")
    .select("id")
    .in("website_id", websiteIds)
    .eq("id", parsed.data.reportId)
    .single();

  if (!report) {
    return apiError("Report not found.", 404);
  }

  try {
    console.info("[api:reports/send] request", {
      reportId: parsed.data.reportId,
      requestedBy: user?.id,
      overrideEmail: parsed.data.email ?? null
    });

    const result = await sendStoredReportEmail({
      reportId: parsed.data.reportId,
      email: parsed.data.email
    });

    console.info("[api:reports/send] success", {
      reportId: parsed.data.reportId,
      requestedBy: user?.id,
      deliveries: result.deliveries.map((delivery) => ({
        recipient: delivery.recipient,
        messageId: delivery.messageId
      }))
    });

    return apiSuccess(result);
  } catch (error) {
    console.error("[api:reports/send] error", {
      reportId: parsed.data.reportId,
      requestedBy: user?.id,
      overrideEmail: parsed.data.email ?? null,
      error: error instanceof Error ? error.message : "Unable to send report."
    });

    return apiError(error instanceof Error ? error.message : "Unable to send report.", 500);
  }
}
