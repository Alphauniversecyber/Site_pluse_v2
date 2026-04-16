import { runContinuableCronRoute } from "@/lib/cron-route";
import { processQueuedPaddleWebhooks } from "@/lib/paddle-subscriptions";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  return runContinuableCronRoute(request, {
    cronName: "process-paddle-webhooks",
    label: "process-paddle-webhooks",
    failureMessage: "Unable to process queued Paddle webhooks.",
    run: async () => processQueuedPaddleWebhooks()
  });
}
