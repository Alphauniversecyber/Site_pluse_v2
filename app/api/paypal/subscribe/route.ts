import { apiError, apiSuccess, requireApiUser } from "@/lib/api";
import { createOrRevisePayPalSubscription } from "@/lib/paypal";
import { paypalSubscribeSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { profile, errorResponse } = await requireApiUser();
  if (errorResponse || !profile) {
    return errorResponse;
  }

  const body = await request.json().catch(() => null);
  const parsed = paypalSubscribeSchema.safeParse(body);

  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid PayPal subscription request.", 422);
  }

  try {
    if (
      profile.plan === parsed.data.plan &&
      profile.billing_cycle === parsed.data.billingCycle &&
      (profile.subscription_status === "active" || profile.subscription_status === "trialing")
    ) {
      return apiError("You are already on this plan and billing cycle.", 409);
    }

    const result = await createOrRevisePayPalSubscription({
      userId: profile.id,
      email: profile.email,
      plan: parsed.data.plan,
      billingCycle: parsed.data.billingCycle,
      currentSubscriptionId:
        profile.paypal_subscription_id &&
        profile.subscription_status !== "cancelled" &&
        profile.subscription_status !== "inactive"
          ? profile.paypal_subscription_id
          : null
    });

    return apiSuccess({
      approvalUrl: result.approvalUrl,
      subscriptionId: result.subscriptionId,
      mode: result.mode
    });
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "Unable to start the PayPal subscription flow.",
      500
    );
  }
}
