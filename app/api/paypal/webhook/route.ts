import { apiError, apiSuccess } from "@/lib/api";
import {
  extractSubscriptionIdFromPayPalEvent,
  markPayPalPaymentDenied,
  syncPayPalSubscription,
  verifyPayPalWebhookSignature
} from "@/lib/paypal";

export const runtime = "nodejs";

const HANDLED_EVENTS = new Set([
  "BILLING.SUBSCRIPTION.CREATED",
  "BILLING.SUBSCRIPTION.ACTIVATED",
  "BILLING.SUBSCRIPTION.CANCELLED",
  "PAYMENT.SALE.COMPLETED",
  "PAYMENT.SALE.DENIED"
]);

export async function POST(request: Request) {
  let event: Record<string, any>;

  try {
    event = (await request.json()) as Record<string, any>;
  } catch {
    return apiError("Invalid PayPal webhook body.", 400);
  }

  try {
    const verification = await verifyPayPalWebhookSignature(request.headers, event);
    if (verification.verification_status !== "SUCCESS") {
      return apiError("Invalid PayPal webhook signature.", 400);
    }
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "Unable to verify the PayPal webhook signature.",
      400
    );
  }

  if (!HANDLED_EVENTS.has(String(event.event_type))) {
    return apiSuccess({ received: true, ignored: true });
  }

  const subscriptionId = extractSubscriptionIdFromPayPalEvent(event);
  if (!subscriptionId) {
    return apiSuccess({ received: true, ignored: true, reason: "No subscription id on event." });
  }

  try {
    switch (event.event_type) {
      case "PAYMENT.SALE.DENIED":
        await markPayPalPaymentDenied({ subscriptionId });
        break;
      default:
        await syncPayPalSubscription({ subscriptionId });
        break;
    }

    return apiSuccess({ received: true });
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "Unable to process the PayPal webhook.",
      500
    );
  }
}
