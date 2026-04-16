import { runContinuableCronRoute } from "@/lib/cron-route";
import { processDueEmailReportsBatch } from "@/lib/report-service";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  return runContinuableCronRoute(request, {
    cronName: "process-reports",
    label: "process-reports",
    failureMessage: "Unable to process scheduled reports.",
    allowContinuation: true,
    run: (cursor) =>
      processDueEmailReportsBatch({
        discoveryOffset: cursor
      })
  });
}
