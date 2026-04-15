import { apiError, apiSuccess } from "@/lib/api";
import { runLoggedCron } from "@/lib/admin/logging";
import { processQueuedPaddleWebhooks } from "@/lib/paddle-subscriptions";

export const runtime = "nodejs";
export const maxDuration = 60;

function isAuthorized(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("[cron:process-paddle-webhooks] Missing CRON_SECRET environment variable.");
    return false;
  }

  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return apiError("Unauthorized", 401);
  }

  try {
    const processed = await runLoggedCron("process-paddle-webhooks", () =>
      processQueuedPaddleWebhooks()
    );

    return apiSuccess({
      processed
    });
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "Unable to process queued Paddle webhooks.",
      500
    );
  }
}
