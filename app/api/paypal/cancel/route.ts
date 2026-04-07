import { apiError, apiSuccess, requireApiUser } from "@/lib/api";
import { cancelAndSyncPayPalSubscription } from "@/lib/paypal";
import { paypalCancelSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { profile, errorResponse } = await requireApiUser();
  if (errorResponse || !profile) {
    return errorResponse;
  }

  if (!profile.paypal_subscription_id) {
    return apiError("No active PayPal subscription found for this account.", 404);
  }

  const body = await request.json().catch(() => ({}));
  const parsed = paypalCancelSchema.safeParse(body);

  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid cancellation request.", 422);
  }

  try {
    const updatedUser = await cancelAndSyncPayPalSubscription({
      userId: profile.id,
      subscriptionId: profile.paypal_subscription_id,
      reason: parsed.data.reason
    });

    return apiSuccess({
      user: updatedUser
    });
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "Unable to cancel the PayPal subscription.",
      500
    );
  }
}
