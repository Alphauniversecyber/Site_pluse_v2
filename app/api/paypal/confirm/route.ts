import { apiError, apiSuccess, requireApiUser } from "@/lib/api";
import { syncPayPalSubscription } from "@/lib/paypal";
import { paypalConfirmSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { profile, errorResponse } = await requireApiUser();
  if (errorResponse || !profile) {
    return errorResponse;
  }

  const body = await request.json().catch(() => null);
  const parsed = paypalConfirmSchema.safeParse(body);

  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid PayPal confirmation request.", 422);
  }

  try {
    const result = await syncPayPalSubscription({
      subscriptionId: parsed.data.subscriptionId,
      fallbackUserId: profile.id
    });

    return apiSuccess({
      user: result.user,
      subscriptionStatus: result.user.subscription_status,
      plan: result.user.plan
    });
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "Unable to confirm the PayPal subscription.",
      500
    );
  }
}
