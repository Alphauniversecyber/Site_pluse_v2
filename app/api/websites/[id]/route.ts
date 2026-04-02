import { apiError, apiSuccess, requireApiUser } from "@/lib/api";
import { PLAN_LIMITS } from "@/lib/utils";
import { websiteUpdateSchema } from "@/lib/validation";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const { supabase, errorResponse } = await requireApiUser();
  if (errorResponse) {
    return errorResponse;
  }

  const [{ data: website, error }, { data: schedule }, { data: scans }] = await Promise.all([
    supabase.from("websites").select("*").eq("id", params.id).single(),
    supabase.from("scan_schedules").select("*").eq("website_id", params.id).maybeSingle(),
    supabase
      .from("scan_results")
      .select("*")
      .eq("website_id", params.id)
      .order("scanned_at", { ascending: false })
      .limit(10)
  ]);

  if (error || !website) {
    return apiError(error?.message ?? "Website not found.", 404);
  }

  return apiSuccess({
    ...website,
    schedule: schedule ?? null,
    scans: scans ?? []
  });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const { supabase, profile, errorResponse } = await requireApiUser();
  if (errorResponse || !profile) {
    return errorResponse;
  }

  const body = await request.json().catch(() => null);
  const parsed = websiteUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid update payload.", 422);
  }

  if (
    parsed.data.frequency &&
    !PLAN_LIMITS[profile.plan].scanFrequencies.includes(parsed.data.frequency)
  ) {
    return apiError("That scan frequency is not available on your current plan.", 403);
  }

  const websiteUpdates: Record<string, unknown> = {};
  if (parsed.data.label !== undefined) {
    websiteUpdates.label = parsed.data.label;
  }
  if (parsed.data.is_active !== undefined) {
    websiteUpdates.is_active = parsed.data.is_active;
  }
  if (parsed.data.email_reports_enabled !== undefined) {
    websiteUpdates.email_reports_enabled =
      profile.plan === "free" ? false : parsed.data.email_reports_enabled;
  }
  if (parsed.data.report_recipients !== undefined) {
    websiteUpdates.report_recipients =
      profile.plan === "free" ? [] : parsed.data.report_recipients;
  }

  const { data: website, error } = await supabase
    .from("websites")
    .update(websiteUpdates)
    .eq("id", params.id)
    .select("*")
    .single();

  if (error || !website) {
    return apiError(error?.message ?? "Unable to update website.", 500);
  }

  if (parsed.data.frequency) {
    await supabase
      .from("scan_schedules")
      .upsert({
        website_id: params.id,
        frequency: parsed.data.frequency,
        next_scan_at: new Date().toISOString()
      })
      .select("*");
  }

  return apiSuccess(website);
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const { supabase, errorResponse } = await requireApiUser();
  if (errorResponse) {
    return errorResponse;
  }

  const { error } = await supabase.from("websites").delete().eq("id", params.id);

  if (error) {
    return apiError(error.message, 500);
  }

  return apiSuccess({ success: true });
}
