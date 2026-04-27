import { apiError, apiSuccess, requireApiUser } from "@/lib/api";
import { buildHealthScore } from "@/lib/health-score";
import { PLAN_LIMITS, normalizeUrl } from "@/lib/utils";
import { websiteSchema } from "@/lib/validation";

export async function GET(request: Request) {
  const { supabase, errorResponse } = await requireApiUser();
  if (errorResponse) {
    return errorResponse;
  }

  const { searchParams } = new URL(request.url);
  const view = searchParams.get("view");

  const { data: websites, error } = await supabase
    .from("websites")
    .select("id,user_id,url,label,is_active,report_frequency,extra_recipients,auto_email_reports,email_notifications,created_at,updated_at")
    .order("created_at", { ascending: false });

  if (error) {
    return apiError(error.message, 500);
  }

  if (view === "summary") {
    return apiSuccess(websites ?? []);
  }

  const websiteIds = (websites ?? []).map((website) => website.id);

  const [
    { data: schedules },
    { data: scanRows },
    { data: seoAudits },
    { data: sslChecks },
    { data: securityHeaders },
    { data: uptimeChecks },
    { data: brokenLinks }
  ] = await Promise.all([
    websiteIds.length
      ? supabase.from("scan_schedules").select("website_id,frequency,next_scan_at,last_scan_at").in("website_id", websiteIds)
      : Promise.resolve({ data: [] }),
    websiteIds.length
      ? supabase
          .from("scan_results")
          .select(
            "id,website_id,performance_score,seo_score,accessibility_score,best_practices_score,lcp,issues,scan_status,error_message,scanned_at"
          )
          .in("website_id", websiteIds)
          .order("scanned_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    websiteIds.length
      ? supabase
          .from("seo_audit")
          .select(
            "website_id,title_tag,meta_description,headings,images_missing_alt,og_tags,twitter_tags,canonical,schema_present,created_at"
          )
          .in("website_id", websiteIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    websiteIds.length
      ? supabase
          .from("ssl_checks")
          .select("website_id,grade,checked_at")
          .in("website_id", websiteIds)
          .order("checked_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    websiteIds.length
      ? supabase
          .from("security_headers")
          .select("website_id,grade,checked_at")
          .in("website_id", websiteIds)
          .order("checked_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    websiteIds.length
      ? supabase
          .from("uptime_checks")
          .select("website_id,status,checked_at")
          .in("website_id", websiteIds)
          .order("checked_at", { ascending: false })
          .limit(300)
      : Promise.resolve({ data: [] }),
    websiteIds.length
      ? supabase
          .from("broken_links")
          .select("website_id,broken_links,scanned_at")
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

  const latestSeoAuditMap = new Map<string, any>();
  for (const audit of seoAudits ?? []) {
    if (!latestSeoAuditMap.has(audit.website_id)) {
      latestSeoAuditMap.set(audit.website_id, audit);
    }
  }

  const latestSslMap = new Map<string, any>();
  for (const check of sslChecks ?? []) {
    if (!latestSslMap.has(check.website_id)) {
      latestSslMap.set(check.website_id, check);
    }
  }

  const latestSecurityHeadersMap = new Map<string, any>();
  for (const record of securityHeaders ?? []) {
    if (!latestSecurityHeadersMap.has(record.website_id)) {
      latestSecurityHeadersMap.set(record.website_id, record);
    }
  }

  const uptimeMap = new Map<string, any[]>();
  for (const check of uptimeChecks ?? []) {
    const current = uptimeMap.get(check.website_id) ?? [];
    current.push(check);
    uptimeMap.set(check.website_id, current);
  }

  const latestBrokenLinksMap = new Map<string, any>();
  for (const record of brokenLinks ?? []) {
    if (!latestBrokenLinksMap.has(record.website_id)) {
      latestBrokenLinksMap.set(record.website_id, record);
    }
  }

  return apiSuccess(
    (websites ?? []).map((website) => ({
      ...website,
      latest_scan: latestScanMap.get(website.id) ?? null,
      schedule: scheduleMap.get(website.id) ?? null,
      ssl_check: latestSslMap.get(website.id) ?? null,
      security_headers: latestSecurityHeadersMap.get(website.id) ?? null,
      broken_links: latestBrokenLinksMap.get(website.id) ?? null,
      health_score: buildHealthScore({
        scan: latestScanMap.get(website.id) ?? null,
        seoAudit: latestSeoAuditMap.get(website.id) ?? null,
        sslCheck: latestSslMap.get(website.id) ?? null,
        securityHeaders: latestSecurityHeadersMap.get(website.id) ?? null,
        uptimeChecks: uptimeMap.get(website.id) ?? []
      })
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
      report_frequency: parsed.data.report_frequency ?? "weekly",
      extra_recipients: parsed.data.extra_recipients ?? [],
      auto_email_reports: parsed.data.auto_email_reports ?? true,
      email_notifications: parsed.data.email_notifications ?? true,
      competitor_urls: parsed.data.competitor_urls ?? []
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
