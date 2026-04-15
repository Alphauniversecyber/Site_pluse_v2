import { apiError, apiSuccess, requireApiUser } from "@/lib/api";
import { createPaddlePortalSession } from "@/lib/paddle";

export const runtime = "nodejs";

export async function POST() {
  const { profile, errorResponse } = await requireApiUser();
  if (errorResponse || !profile) {
    return errorResponse;
  }

  if (!profile.paddle_customer_id) {
    return apiError("No Paddle customer is linked to this account yet.", 404);
  }

  try {
    const session = await createPaddlePortalSession({
      customerId: profile.paddle_customer_id,
      subscriptionId: profile.paddle_subscription_id
    });

    const subscriptionLinks = session.urls.subscriptions?.[0];
    const url =
      subscriptionLinks?.update_subscription_payment_method ??
      subscriptionLinks?.cancel_subscription ??
      session.urls.general?.overview;

    if (!url) {
      return apiError("Paddle did not return a customer portal link.", 500);
    }

    return apiSuccess({
      url,
      overviewUrl: session.urls.general?.overview ?? null,
      cancelUrl: subscriptionLinks?.cancel_subscription ?? null,
      updatePaymentMethodUrl: subscriptionLinks?.update_subscription_payment_method ?? null
    });
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "Unable to create Paddle customer portal session.",
      500
    );
  }
}
