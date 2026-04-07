import "server-only";

import { addDays, isAfter } from "date-fns";

import { BILLING_PLANS, getPlanAmount, getPayPalPlanName, type PaidPlanKey } from "@/lib/billing";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getBaseUrl } from "@/lib/utils";
import type { BillingCycle, SubscriptionStatus, UserProfile } from "@/types";

type PayPalLink = {
  href: string;
  rel: string;
  method?: string;
};

type PayPalListResponse<T> = {
  plans?: T[];
  products?: T[];
};

type PayPalProduct = {
  id: string;
  name: string;
};

type PayPalPlan = {
  id: string;
  name: string;
  status?: string;
};

type PayPalSubscription = {
  id: string;
  status: string;
  plan_id: string;
  custom_id?: string | null;
  start_time?: string | null;
  create_time?: string | null;
  subscriber?: {
    payer_id?: string | null;
    email_address?: string | null;
  };
  billing_info?: {
    next_billing_time?: string | null;
  };
  links?: PayPalLink[];
};

type PayPalVerificationResponse = {
  verification_status: "SUCCESS" | "FAILURE";
};

const PAYPAL_PRODUCT_NAME = "SitePulse SaaS";
const PAYPAL_PRODUCT_DESCRIPTION = "Recurring subscriptions for SitePulse website monitoring.";
const PAYPAL_BLUE = "#60A5FA";

let accessTokenCache:
  | {
      token: string;
      expiresAt: number;
    }
  | null = null;
let productIdCache: string | null = null;
const planIdCache = new Map<string, string>();

function getPayPalBaseUrl() {
  return process.env.NODE_ENV === "production"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

function assertPayPalEnv() {
  if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
    throw new Error("Missing PayPal credentials. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET.");
  }
}

async function getPayPalAccessToken() {
  assertPayPalEnv();

  if (accessTokenCache && Date.now() < accessTokenCache.expiresAt) {
    return accessTokenCache.token;
  }

  const credentials = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString("base64");

  const response = await fetch(`${getPayPalBaseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials",
    cache: "no-store"
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Unable to get PayPal access token: ${message}`);
  }

  const payload = (await response.json()) as {
    access_token: string;
    expires_in: number;
  };

  accessTokenCache = {
    token: payload.access_token,
    expiresAt: Date.now() + Math.max(payload.expires_in - 60, 60) * 1000
  };

  return payload.access_token;
}

async function paypalRequest<T>(
  path: string,
  input: {
    method?: string;
    body?: Record<string, unknown>;
    headers?: Record<string, string>;
  } = {}
) {
  const token = await getPayPalAccessToken();
  const response = await fetch(`${getPayPalBaseUrl()}${path}`, {
    method: input.method ?? "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(input.headers ?? {})
    },
    body: input.body ? JSON.stringify(input.body) : undefined,
    cache: "no-store"
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`PayPal request failed (${response.status}): ${message}`);
  }

  if (response.status === 204) {
    return null as T;
  }

  return (await response.json()) as T;
}

async function getOrCreateProductId() {
  if (productIdCache) {
    return productIdCache;
  }

  const listed = await paypalRequest<PayPalListResponse<PayPalProduct>>(
    "/v1/catalogs/products?page_size=20&page=1&total_required=false"
  );
  const existing = listed.products?.find((product) => product.name === PAYPAL_PRODUCT_NAME);

  if (existing) {
    productIdCache = existing.id;
    return existing.id;
  }

  const created = await paypalRequest<PayPalProduct>("/v1/catalogs/products", {
    method: "POST",
    headers: {
      Prefer: "return=representation",
      "PayPal-Request-Id": `product-${crypto.randomUUID()}`
    },
    body: {
      name: PAYPAL_PRODUCT_NAME,
      description: PAYPAL_PRODUCT_DESCRIPTION,
      type: "SERVICE",
      category: "SOFTWARE"
    }
  });

  productIdCache = created.id;
  return created.id;
}

function getPlanKey(plan: PaidPlanKey, billingCycle: BillingCycle) {
  return `${plan}:${billingCycle}`;
}

async function getOrCreatePlanId(plan: PaidPlanKey, billingCycle: BillingCycle) {
  const cacheKey = getPlanKey(plan, billingCycle);
  const cached = planIdCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const productId = await getOrCreateProductId();
  const planName = getPayPalPlanName(plan, billingCycle);
  const listed = await paypalRequest<PayPalListResponse<PayPalPlan>>(
    `/v1/billing/plans?product_id=${encodeURIComponent(productId)}&page_size=20&page=1&total_required=false`,
    {
      headers: {
        Prefer: "return=representation"
      }
    }
  );
  const existing = listed.plans?.find(
    (item) => item.name === planName && (item.status ?? "ACTIVE") === "ACTIVE"
  );

  if (existing) {
    planIdCache.set(cacheKey, existing.id);
    return existing.id;
  }

  const amount = getPlanAmount(plan, billingCycle).toFixed(0);
  const created = await paypalRequest<PayPalPlan & { id: string }>("/v1/billing/plans", {
    method: "POST",
    headers: {
      Prefer: "return=representation",
      "PayPal-Request-Id": `plan-${cacheKey}-${crypto.randomUUID()}`
    },
    body: {
      product_id: productId,
      name: planName,
      description: `${BILLING_PLANS[plan].displayName} ${billingCycle} subscription for SitePulse`,
      status: "ACTIVE",
      billing_cycles: [
        {
          frequency: {
            interval_unit: "DAY",
            interval_count: 1
          },
          tenure_type: "TRIAL",
          sequence: 1,
          total_cycles: BILLING_PLANS[plan].trialDays,
          pricing_scheme: {
            fixed_price: {
              currency_code: "USD",
              value: "0"
            }
          }
        },
        {
          frequency: {
            interval_unit: billingCycle === "yearly" ? "YEAR" : "MONTH",
            interval_count: 1
          },
          tenure_type: "REGULAR",
          sequence: 2,
          total_cycles: 0,
          pricing_scheme: {
            fixed_price: {
              currency_code: "USD",
              value: amount
            }
          }
        }
      ],
      payment_preferences: {
        auto_bill_outstanding: true,
        setup_fee: {
          currency_code: "USD",
          value: "0"
        },
        setup_fee_failure_action: "CONTINUE",
        payment_failure_threshold: 3
      }
    }
  });

  planIdCache.set(cacheKey, created.id);
  return created.id;
}

function findApprovalUrl(links: PayPalLink[] | undefined) {
  return links?.find((link) => link.rel === "approve")?.href ?? null;
}

function addTrialEndDate(sourceTime: string | null | undefined, plan: PaidPlanKey) {
  if (!sourceTime) {
    return null;
  }

  return addDays(new Date(sourceTime), BILLING_PLANS[plan].trialDays).toISOString();
}

function mapPayPalStatus(status: string, trialEndDate: string | null): SubscriptionStatus {
  const upper = status.toUpperCase();

  if (upper === "CANCELLED" || upper === "EXPIRED") {
    return "cancelled";
  }

  if (upper === "SUSPENDED") {
    return "suspended";
  }

  if (upper === "APPROVAL_PENDING" || upper === "CREATED") {
    return "approval_pending";
  }

  if (upper === "ACTIVE" || upper === "APPROVED") {
    if (trialEndDate && isAfter(new Date(trialEndDate), new Date())) {
      return "trialing";
    }

    return "active";
  }

  return "inactive";
}

async function resolvePlanFromPlanId(planId: string) {
  const paidPlans: PaidPlanKey[] = ["starter", "agency"];
  const cycles: BillingCycle[] = ["monthly", "yearly"];

  for (const plan of paidPlans) {
    for (const billingCycle of cycles) {
      const knownId = await getOrCreatePlanId(plan, billingCycle);
      if (knownId === planId) {
        return {
          plan,
          billingCycle,
          price: getPlanAmount(plan, billingCycle)
        };
      }
    }
  }

  throw new Error(`Unknown PayPal plan id: ${planId}`);
}

export async function createOrRevisePayPalSubscription(input: {
  userId: string;
  email: string;
  plan: PaidPlanKey;
  billingCycle: BillingCycle;
  currentSubscriptionId?: string | null;
}) {
  const planId = await getOrCreatePlanId(input.plan, input.billingCycle);
  const returnUrl = `${getBaseUrl()}/dashboard/billing?paypal=success`;
  const cancelUrl = `${getBaseUrl()}/dashboard/billing?paypal=canceled`;

  if (input.currentSubscriptionId) {
    const revised = await paypalRequest<{ id: string; links?: PayPalLink[] }>(
      `/v1/billing/subscriptions/${input.currentSubscriptionId}/revise`,
      {
        method: "POST",
        headers: {
          Prefer: "return=representation"
        },
        body: {
          plan_id: planId,
          application_context: {
            brand_name: "SitePulse",
            return_url: returnUrl,
            cancel_url: cancelUrl
          }
        }
      }
    );

    const approvalUrl = findApprovalUrl(revised.links);
    if (!approvalUrl) {
      throw new Error("PayPal did not return an approval link for the subscription change.");
    }

    return {
      subscriptionId: revised.id ?? input.currentSubscriptionId,
      approvalUrl,
      mode: "revise" as const
    };
  }

  const created = await paypalRequest<{ id: string; links?: PayPalLink[] }>(
    "/v1/billing/subscriptions",
    {
      method: "POST",
      headers: {
        Prefer: "return=representation",
        "PayPal-Request-Id": `subscription-${crypto.randomUUID()}`
      },
      body: {
        plan_id: planId,
        custom_id: input.userId,
        subscriber: {
          email_address: input.email
        },
        application_context: {
          brand_name: "SitePulse",
          user_action: "SUBSCRIBE_NOW",
          return_url: returnUrl,
          cancel_url: cancelUrl
        }
      }
    }
  );

  const approvalUrl = findApprovalUrl(created.links);
  if (!approvalUrl) {
    throw new Error("PayPal did not return an approval link for the new subscription.");
  }

  return {
    subscriptionId: created.id,
    approvalUrl,
    mode: "create" as const
  };
}

export async function getPayPalSubscription(subscriptionId: string) {
  return paypalRequest<PayPalSubscription>(
    `/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`
  );
}

export async function syncPayPalSubscription(input: {
  subscriptionId: string;
  fallbackUserId?: string | null;
}) {
  const subscription = await getPayPalSubscription(input.subscriptionId);
  const admin = createSupabaseAdminClient();
  const resolved = await resolvePlanFromPlanId(subscription.plan_id);
  const userId = subscription.custom_id || input.fallbackUserId;

  if (!userId) {
    throw new Error("Unable to determine which user owns this PayPal subscription.");
  }

  const { data: currentUser, error: userLookupError } = await admin
    .from("users")
    .select("*")
    .eq("id", userId)
    .single<UserProfile>();

  if (userLookupError || !currentUser) {
    throw new Error(userLookupError?.message ?? "User not found for PayPal subscription sync.");
  }

  const trialEndDate = addTrialEndDate(subscription.start_time ?? subscription.create_time, resolved.plan);
  const mappedStatus = mapPayPalStatus(subscription.status, trialEndDate);
  const shouldGrantPaidAccess = mappedStatus === "trialing" || mappedStatus === "active";

  const nextPlan =
    mappedStatus === "cancelled"
      ? "free"
      : shouldGrantPaidAccess
        ? resolved.plan
        : currentUser.plan;

  const updatePayload = {
    plan: nextPlan,
    paypal_subscription_id: mappedStatus === "cancelled" ? null : subscription.id,
    paypal_plan_id: mappedStatus === "cancelled" ? null : subscription.plan_id,
    paypal_payer_id:
      mappedStatus === "cancelled"
        ? currentUser.paypal_payer_id
        : subscription.subscriber?.payer_id ?? currentUser.paypal_payer_id,
    billing_cycle: mappedStatus === "cancelled" ? null : resolved.billingCycle,
    subscription_price: mappedStatus === "cancelled" ? null : resolved.price,
    subscription_status: mappedStatus,
    next_billing_date:
      mappedStatus === "cancelled" ? null : subscription.billing_info?.next_billing_time ?? null,
    trial_end_date: mappedStatus === "cancelled" ? null : trialEndDate
  };

  const { data: updatedUser, error: updateError } = await admin
    .from("users")
    .update(updatePayload)
    .eq("id", userId)
    .select("*")
    .single<UserProfile>();

  if (updateError || !updatedUser) {
    throw new Error(updateError?.message ?? "Unable to sync PayPal subscription.");
  }

  return {
    user: updatedUser,
    subscription,
    resolvedPlan: resolved
  };
}

export async function markPayPalPaymentDenied(input: {
  subscriptionId: string;
  fallbackUserId?: string | null;
}) {
  const subscription = await getPayPalSubscription(input.subscriptionId);
  const userId = subscription.custom_id || input.fallbackUserId;

  if (!userId) {
    throw new Error("Unable to determine which user owns the denied PayPal payment.");
  }

  const resolved = await resolvePlanFromPlanId(subscription.plan_id);
  const admin = createSupabaseAdminClient();
  const { data: updatedUser, error } = await admin
    .from("users")
    .update({
      paypal_subscription_id: subscription.id,
      paypal_plan_id: subscription.plan_id,
      paypal_payer_id: subscription.subscriber?.payer_id ?? null,
      billing_cycle: resolved.billingCycle,
      subscription_price: resolved.price,
      subscription_status: "payment_denied"
    })
    .eq("id", userId)
    .select("*")
    .single<UserProfile>();

  if (error || !updatedUser) {
    throw new Error(error?.message ?? "Unable to mark PayPal payment as denied.");
  }

  return updatedUser;
}

export async function cancelPayPalSubscription(subscriptionId: string, reason = "User requested cancellation.") {
  await paypalRequest<null>(`/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`, {
    method: "POST",
    body: {
      reason
    }
  });
}

export async function cancelAndSyncPayPalSubscription(input: {
  userId: string;
  subscriptionId: string;
  reason?: string;
}) {
  await cancelPayPalSubscription(input.subscriptionId, input.reason);

  const admin = createSupabaseAdminClient();
  const { data: updatedUser, error } = await admin
    .from("users")
    .update({
      plan: "free",
      paypal_subscription_id: null,
      paypal_plan_id: null,
      subscription_status: "cancelled",
      next_billing_date: null,
      billing_cycle: null,
      subscription_price: null,
      trial_end_date: null
    })
    .eq("id", input.userId)
    .select("*")
    .single<UserProfile>();

  if (error || !updatedUser) {
    throw new Error(error?.message ?? "Unable to update the user after PayPal cancellation.");
  }

  return updatedUser;
}

export async function verifyPayPalWebhookSignature(headers: Headers, webhookEvent: Record<string, unknown>) {
  if (!process.env.PAYPAL_WEBHOOK_ID) {
    throw new Error("Missing PAYPAL_WEBHOOK_ID.");
  }

  const transmissionId = headers.get("paypal-transmission-id");
  const transmissionTime = headers.get("paypal-transmission-time");
  const transmissionSig = headers.get("paypal-transmission-sig");
  const certUrl = headers.get("paypal-cert-url");
  const authAlgo = headers.get("paypal-auth-algo");

  if (!transmissionId || !transmissionTime || !transmissionSig || !certUrl || !authAlgo) {
    throw new Error("Missing PayPal webhook signature headers.");
  }

  return paypalRequest<PayPalVerificationResponse>("/v1/notifications/verify-webhook-signature", {
    method: "POST",
    body: {
      transmission_id: transmissionId,
      transmission_time: transmissionTime,
      transmission_sig: transmissionSig,
      cert_url: certUrl,
      auth_algo: authAlgo,
      webhook_id: process.env.PAYPAL_WEBHOOK_ID,
      webhook_event: webhookEvent
    }
  });
}

export function extractSubscriptionIdFromPayPalEvent(event: Record<string, any>) {
  const resource = event.resource ?? {};

  return (
    resource.id ??
    resource.billing_agreement_id ??
    resource.supplementary_data?.related_ids?.subscription_id ??
    resource.custom ??
    null
  );
}

export function getPayPalEnvironmentLabel() {
  return process.env.NODE_ENV === "production" ? "Production" : "Sandbox";
}

export function getDarkSurfaceAccentColor() {
  return PAYPAL_BLUE;
}
