import { runContinuableCronRoute } from "@/lib/cron-route";
import { processDueScansBatch } from "@/lib/scan-service";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  return runContinuableCronRoute(request, {
    cronName: "process-scans",
    label: "process-scans",
    failureMessage: "Unable to process scheduled scans.",
    continuationMode: "scheduled",
    run: (cursor) =>
      processDueScansBatch({
        discoveryOffset: cursor
      })
  });
}
