import "server-only";

import Stripe from "stripe";

import type { PlanKey } from "@/types";
import { getBaseUrl } from "@/lib/utils";

const planCatalog: Record<Exclude<PlanKey, "free">, { name: string; amount: number }> = {
  starter: {
    name: "Starter",
    amount: 4900
  },
  agency: {
    name: "Agency",
    amount: 14900
  }
};

let stripeClient: Stripe | null = null;

export function getStripeClient() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("Missing STRIPE_SECRET_KEY.");
  }

  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-02-24.acacia"
    });
  }

  return stripeClient;
}

export async function createCheckoutSession(input: {
  plan: Exclude<PlanKey, "free">;
  userId: string;
  email: string;
  customerId?: string | null;
}) {
  const stripe = getStripeClient();
  const plan = planCatalog[input.plan];

  return stripe.checkout.sessions.create({
    mode: "subscription",
    success_url: `${getBaseUrl()}/dashboard/billing?checkout=success`,
    cancel_url: `${getBaseUrl()}/pricing?checkout=canceled`,
    customer: input.customerId ?? undefined,
    customer_email: input.customerId ? undefined : input.email,
    allow_promotion_codes: true,
    metadata: {
      userId: input.userId,
      plan: input.plan
    },
    subscription_data: {
      metadata: {
        userId: input.userId,
        plan: input.plan
      }
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: plan.amount,
          recurring: {
            interval: "month"
          },
          product_data: {
            name: `SitePulse ${plan.name}`,
            description: `${plan.name} plan for website monitoring and reporting`
          }
        }
      }
    ]
  });
}

export async function createBillingPortalSession(customerId: string) {
  const stripe = getStripeClient();

  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${getBaseUrl()}/dashboard/billing`
  });
}

export function getPlanAmount(plan: Exclude<PlanKey, "free">) {
  return planCatalog[plan].amount;
}
