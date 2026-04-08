import { apiError, apiSuccess, requireApiUser } from "@/lib/api";

export const runtime = "nodejs";

const UNREAD_NOTIFICATION_TYPES = [
  "score_drop",
  "critical_score",
  "scan_failure",
  "report_ready",
  "accessibility_regression",
  "ssl_expiry",
  "uptime_alert",
  "competitor_alert",
  "broken_links_alert"
] as const;

export async function GET() {
  const { supabase, user, errorResponse } = await requireApiUser();
  if (errorResponse || !user) {
    return errorResponse;
  }

  const { count, error } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("is_read", false)
    .in("type", [...UNREAD_NOTIFICATION_TYPES]);

  if (error) {
    return apiError(error.message, 500);
  }

  return apiSuccess({ count: count ?? 0 });
}
