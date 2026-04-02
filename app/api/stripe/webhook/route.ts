import Stripe from "stripe";

import { apiError, apiSuccess } from "@/lib/api";
import { getStripeClient } from "@/lib/stripe";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";

function getPlanFromMetadata(metadata: Record<string, string | undefined> | null | undefined) {
  const plan = metadata?.plan;
  return plan === "starter" || plan === "agency" ? plan : "free";
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !secret) {
    return apiError("Missing Stripe webhook configuration.", 400);
  }

  const body = await request.text();
  const stripe = getStripeClient();
  const admin = createSupabaseAdminClient();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Invalid Stripe signature.", 400);
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as any;
      const userId = session.metadata?.userId;
      const plan = getPlanFromMetadata(session.metadata);

      if (userId) {
        await admin
          .from("users")
          .update({
            plan,
            stripe_customer_id: typeof session.customer === "string" ? session.customer : null,
            stripe_subscription_id:
              typeof session.subscription === "string" ? session.subscription : null
          })
          .eq("id", userId);
      }
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as any;
      const userId = subscription.metadata?.userId;
      const plan = getPlanFromMetadata(subscription.metadata);

      if (userId) {
        await admin
          .from("users")
          .update({
            plan,
            stripe_customer_id: typeof subscription.customer === "string" ? subscription.customer : null,
            stripe_subscription_id: subscription.id
          })
          .eq("id", userId);
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as any;
      const userId = subscription.metadata?.userId;

      if (userId) {
        await admin
          .from("users")
          .update({
            plan: "free",
            stripe_subscription_id: null
          })
          .eq("id", userId);
      }
      break;
    }

    default:
      break;
  }

  return apiSuccess({ received: true });
}
