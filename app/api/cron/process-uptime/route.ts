import { runContinuableCronRoute } from "@/lib/cron-route";
import { processDailyUptimeChecksBatch } from "@/lib/uptime-monitoring";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  return runContinuableCronRoute(request, {
    cronName: "process-uptime",
    label: "process-uptime",
    failureMessage: "Unable to process uptime checks.",
    run: (cursor) =>
      processDailyUptimeChecksBatch({
        offset: cursor
      })
  });
}
