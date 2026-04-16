import { runContinuableCronRoute } from "@/lib/cron-route";
import { processCompetitorScansBatch } from "@/lib/competitor-monitoring";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  return runContinuableCronRoute(request, {
    cronName: "process-competitors",
    label: "process-competitors",
    failureMessage: "Unable to process competitor scans.",
    run: (cursor) =>
      processCompetitorScansBatch({
        offset: cursor
      })
  });
}
