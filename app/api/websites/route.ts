import { apiError, apiSuccess, requireApiUser } from "@/lib/api";
import { PLAN_LIMITS, normalizeUrl } from "@/lib/utils";
import { websiteSchema } from "@/lib/validation";

export async function GET() {
  const { supabase, errorResponse } = await requireApiUser();
  if (errorResponse) {
    return errorResponse;
  }

  const { data: websites, error } = await supabase
    .from("websites")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return apiError(error.message, 500);
  }

  const websiteIds = (websites ?? []).map((website) => website.id);

  const [{ data: schedules }, { data: scanRows }] = await Promise.all([
    websiteIds.length
      ? supabase.from("scan_schedules").select("*").in("website_id", websiteIds)
      : Promise.resolve({ data: [] }),
    websiteIds.length
      ? supabase
          .from("scan_results")
          .select("*")
          .in("website_id", websiteIds)
          .order("scanned_at", { ascending: false })
      : Promise.resolve({ data: [] })
  ]);

  const latestScanMap = new Map<string, any>();
  for (const scan of scanRows ?? []) {
    if (!latestScanMap.has(scan.website_id)) {
      latestScanMap.set(scan.website_id, scan);
    }
  }

  const scheduleMap = new Map<string, any>();
  for (const schedule of schedules ?? []) {
    scheduleMap.set(schedule.website_id, schedule);
  }

  return apiSuccess(
    (websites ?? []).map((website) => ({
      ...website,
      latest_scan: latestScanMap.get(website.id) ?? null,
      schedule: scheduleMap.get(website.id) ?? null
    }))
  );
}

export async function POST(request: Request) {
  const { supabase, profile, errorResponse } = await requireApiUser();
  if (errorResponse || !profile) {
    return errorResponse;
  }

  const body = await request.json().catch(() => null);
  const parsed = websiteSchema.safeParse(body);

  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid website payload.", 422);
  }

  const { count, error: countError } = await supabase
    .from("websites")
    .select("*", { count: "exact", head: true })
    .eq("user_id", profile.id);

  if (countError) {
    return apiError(countError.message, 500);
  }

  if ((count ?? 0) >= PLAN_LIMITS[profile.plan].websiteLimit) {
    return apiError(`Your ${PLAN_LIMITS[profile.plan].name} plan limit has been reached.`, 403);
  }

  const normalizedUrl = normalizeUrl(parsed.data.url);
  const defaultFrequency = PLAN_LIMITS[profile.plan].scanFrequencies[0];

  const { data: website, error } = await supabase
    .from("websites")
    .insert({
      user_id: profile.id,
      url: normalizedUrl,
      label: parsed.data.label,
      email_reports_enabled: profile.plan !== "free" ? parsed.data.email_reports_enabled : false,
      report_recipients: profile.plan !== "free" ? parsed.data.report_recipients : []
    })
    .select("*")
    .single();

  if (error || !website) {
    return apiError(error?.message ?? "Unable to create website.", 500);
  }

  const { error: scheduleError } = await supabase.from("scan_schedules").insert({
    website_id: website.id,
    frequency: defaultFrequency,
    next_scan_at: new Date().toISOString()
  });

  if (scheduleError) {
    return apiError(scheduleError.message, 500);
  }

  return apiSuccess(website, 201);
}
