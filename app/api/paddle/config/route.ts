import { apiError, apiSuccess, requireApiUser } from "@/lib/api";
import { getPaddleCheckoutConfig } from "@/lib/paddle";
import { paddleCheckoutSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { profile, errorResponse } = await requireApiUser();
  if (errorResponse || !profile) {
    return errorResponse;
  }

  const body = await request.json().catch(() => null);
  const parsed = paddleCheckoutSchema.safeParse(body);

  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid Paddle checkout request.", 422);
  }

  if (
    profile.plan === parsed.data.plan &&
    profile.billing_cycle === parsed.data.billingCycle &&
    profile.subscription_status &&
    ["active", "trialing", "past_due", "paused"].includes(profile.subscription_status)
  ) {
    return apiError("You are already on this plan and billing cycle.", 409);
  }

  try {
    const config = await getPaddleCheckoutConfig({
      plan: parsed.data.plan,
      billingCycle: parsed.data.billingCycle,
      userId: profile.id
    });

    return apiSuccess({
      ...config,
      customerEmail: profile.email
    });
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "Unable to prepare Paddle checkout.",
      500
    );
  }
}
