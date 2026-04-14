import { apiError, apiSuccess } from "@/lib/api";
import { runLoggedCron } from "@/lib/admin/logging";
import { processUptimeRobotSync } from "@/lib/uptime-monitoring";

export const runtime = "nodejs";
export const maxDuration = 300;

function isAuthorized(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[cron:sync-uptimerobot] Missing CRON_SECRET environment variable.");
    return false;
  }

  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    console.warn("[cron:sync-uptimerobot] Unauthorized request.", {
      hasAuthorizationHeader: request.headers.has("authorization"),
      userAgent: request.headers.get("user-agent")
    });
    return apiError("Unauthorized", 401);
  }

  try {
    const synced = await runLoggedCron("sync-uptimerobot", () => processUptimeRobotSync());
    return apiSuccess({ synced });
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Unable to sync UptimeRobot data.", 500);
  }
}
