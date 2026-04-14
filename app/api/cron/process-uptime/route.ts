import { apiError, apiSuccess } from "@/lib/api";
import { runLoggedCron } from "@/lib/admin/logging";
import { processDailyUptimeChecks } from "@/lib/uptime-monitoring";

export const runtime = "nodejs";
export const maxDuration = 300;

function isAuthorized(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[cron:process-uptime] Missing CRON_SECRET environment variable.");
    return false;
  }

  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    console.warn("[cron:process-uptime] Unauthorized request.", {
      hasAuthorizationHeader: request.headers.has("authorization"),
      userAgent: request.headers.get("user-agent")
    });
    return apiError("Unauthorized", 401);
  }

  try {
    const processed = await runLoggedCron("process-uptime", () => processDailyUptimeChecks());
    return apiSuccess({ processed });
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Unable to process uptime checks.", 500);
  }
}
