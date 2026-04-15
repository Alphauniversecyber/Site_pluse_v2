import { apiError, apiSuccess, requireApiUser } from "@/lib/api";
import { cancelUserPaddleSubscription } from "@/lib/paddle-subscriptions";

export const runtime = "nodejs";

export async function POST() {
  const { profile, errorResponse } = await requireApiUser();
  if (errorResponse || !profile) {
    return errorResponse;
  }

  try {
    const result = await cancelUserPaddleSubscription(profile);

    return apiSuccess({
      subscriptionId: result.subscription.id,
      status: result.subscription.status,
      nextBillingDate: result.subscription.next_billed_at,
      scheduledCancellationAt: result.scheduledCancellationAt,
      planName: result.selection.planName
    });
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "Unable to cancel the Paddle subscription.",
      500
    );
  }
}
