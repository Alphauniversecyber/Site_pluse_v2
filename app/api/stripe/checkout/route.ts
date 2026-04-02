import { apiError, apiSuccess, requireApiUser } from "@/lib/api";
import { createCheckoutSession } from "@/lib/stripe";
import { checkoutSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { profile, errorResponse } = await requireApiUser();
  if (errorResponse || !profile) {
    return errorResponse;
  }

  const body = await request.json().catch(() => null);
  const parsed = checkoutSchema.safeParse(body);

  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid checkout request.", 422);
  }

  try {
    const session = await createCheckoutSession({
      plan: parsed.data.plan,
      userId: profile.id,
      email: profile.email,
      customerId: profile.stripe_customer_id
    });

    return apiSuccess({ url: session.url });
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Unable to create checkout session.", 500);
  }
}
