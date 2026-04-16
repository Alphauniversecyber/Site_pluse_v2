import { runContinuableCronRoute } from "@/lib/cron-route";
import { processUptimeRobotSyncBatch } from "@/lib/uptime-monitoring";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  return runContinuableCronRoute(request, {
    cronName: "sync-uptimerobot",
    label: "sync-uptimerobot",
    failureMessage: "Unable to sync UptimeRobot data.",
    run: (cursor) =>
      processUptimeRobotSyncBatch({
        offset: cursor
      })
  });
}
