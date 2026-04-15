import { apiError, apiSuccess } from "@/lib/api";
import { queuePaddleWebhook } from "@/lib/paddle-subscriptions";
import { verifyPaddleWebhookSignature } from "@/lib/paddle";
import { logAdminError } from "@/lib/admin/logging";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = await request.text();

  try {
    verifyPaddleWebhookSignature(rawBody, request.headers.get("Paddle-Signature"));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to verify the Paddle webhook signature.";

    await logAdminError({
      errorType: "webhook_failed",
      errorMessage: message,
      context: {
        reason: "signature_verification_failed"
      }
    });

    return apiError(message, 400);
  }

  let payload: Record<string, unknown>;

  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return apiError("Invalid Paddle webhook body.", 400);
  }

  try {
    const queued = await queuePaddleWebhook(payload);
    return apiSuccess({
      received: true,
      queued: queued.queued,
      ignored: queued.ignored,
      eventType: payload.event_type ?? null
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to queue the Paddle webhook.";

    await logAdminError({
      errorType: "webhook_failed",
      errorMessage: message,
      context: {
        eventType: payload.event_type ?? null
      }
    });

    return apiError(message, 500);
  }
}
