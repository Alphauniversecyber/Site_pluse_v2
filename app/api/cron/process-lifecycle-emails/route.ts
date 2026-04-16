import { runContinuableCronRoute } from "@/lib/cron-route";
import { processLifecycleEmailsBatch } from "@/lib/lifecycle-email-service";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  return runContinuableCronRoute(request, {
    cronName: "process-lifecycle-emails",
    label: "process-lifecycle-emails",
    failureMessage: "Unable to process lifecycle emails.",
    run: (cursor) =>
      processLifecycleEmailsBatch({
        offset: cursor
      })
  });
}
