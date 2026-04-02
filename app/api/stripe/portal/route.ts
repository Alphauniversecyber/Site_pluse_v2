import { apiError, apiSuccess, requireApiUser } from "@/lib/api";
import { createBillingPortalSession } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST() {
  const { profile, errorResponse } = await requireApiUser();
  if (errorResponse || !profile) {
    return errorResponse;
  }

  if (!profile.stripe_customer_id) {
    return apiError("No Stripe customer found for this account.", 404);
  }

  try {
    const session = await createBillingPortalSession(profile.stripe_customer_id);
    return apiSuccess({ url: session.url });
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Unable to open billing portal.", 500);
  }
}
