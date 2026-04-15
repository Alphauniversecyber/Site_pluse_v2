import "server-only";

import crypto from "node:crypto";

import {
  getPaddlePlanName,
  getPlanPricing,
  isPaidPlan,
  type PaidPlanKey
} from "@/lib/billing";
import { getBaseUrl } from "@/lib/utils";
import type { BillingCycle, PlanKey } from "@/types";

type PaddleEnvironment = "sandbox" | "production";

type PaddleApiResponse<T> = {
  data: T;
  meta?: {
    request_id?: string;
    pagination?: {
      next?: string | null;
    };
  };
};

type PaddleListResponse<T> = {
  data: T[];
  meta?: {
    request_id?: string;
    pagination?: {
      next?: string | null;
    };
  };
};

type PaddleClientToken = {
  id: string;
  token: string;
  name: string;
  description: string | null;
  status: string;
};

type PaddleProduct = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  tax_category: string;
  custom_data: Record<string, unknown> | null;
};

type PaddlePrice = {
  id: string;
  product_id: string;
  name: string | null;
  description: string;
  status: string;
  billing_cycle: {
    interval: "month" | "year";
    frequency: number;
  } | null;
  unit_price: {
    amount: string;
    currency_code: string;
  };
  custom_data: Record<string, unknown> | null;
};

export type PaddleCheckoutCustomData = {
  userId: string;
  plan: PaidPlanKey;
  billingCycle: BillingCycle;
  planName: string;
  originalPrice: number;
  salePrice: number;
  source: "sitepulse-dashboard";
};

export type PaddleCheckoutSessionConfig = {
  environment: PaddleEnvironment;
  vendorId: string;
  clientToken: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  plan: PaidPlanKey;
  billingCycle: BillingCycle;
  planName: string;
  originalPrice: number;
  salePrice: number;
};

export type PaddlePortalSession = {
  id: string;
  customer_id: string;
  urls: {
    general?: {
      overview?: string;
    };
    subscriptions?: Array<{
      subscription_id?: string;
      cancel_subscription?: string;
      update_subscription_payment_method?: string;
    }>;
  };
};

export type PaddleSubscription = {
  id: string;
  status: string;
  customer_id: string;
  currency_code: string;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  first_billed_at: string | null;
  next_billed_at: string | null;
  canceled_at: string | null;
  scheduled_change: {
    action?: string;
    effective_at?: string | null;
  } | null;
  items: Array<{
    quantity: number;
    price: {
      id: string;
      product_id?: string | null;
      name?: string | null;
      billing_cycle?: {
        interval: "month" | "year";
        frequency: number;
      } | null;
      unit_price?: {
        amount: string;
        currency_code: string;
      };
    };
  }>;
  management_urls?: Record<string, unknown> | null;
  custom_data: Record<string, unknown> | null;
};

export type PaddleTransaction = {
  id: string;
  status: string;
  customer_id: string | null;
  subscription_id: string | null;
  custom_data: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  billed_at: string | null;
  currency_code: string;
  customer?: {
    id: string;
    email: string;
    name: string | null;
  } | null;
  items?: Array<{
    quantity?: number;
    price?: {
      id?: string | null;
      product_id?: string | null;
      name?: string | null;
    } | null;
  }>;
  details?: {
    totals?: {
      total?: string;
      subtotal?: string;
      tax?: string;
      discount?: string;
    };
  } | null;
  payments?: Array<{
    status?: string;
    created_at?: string;
    amount?: string;
  }>;
};

type PaddleCatalogProductDefinition = {
  plan: PaidPlanKey;
  productName: string;
  description: string;
};

const CLIENT_TOKEN_NAME = "SitePulse Dashboard Checkout";
const CLIENT_TOKEN_DESCRIPTION =
  "Used by the authenticated billing dashboard to initialize Paddle Checkout.";
const DEFAULT_TAX_CATEGORY = "standard";

const PRODUCT_DEFINITIONS: Record<PaidPlanKey, PaddleCatalogProductDefinition> = {
  starter: {
    plan: "starter",
    productName: "SitePulse Growth",
    description: "Growth subscription for agencies managing multiple client sites."
  },
  agency: {
    plan: "agency",
    productName: "SitePulse Pro",
    description: "Pro subscription for agencies running premium monitoring and reporting."
  }
};

let cachedClientToken: string | null = null;
const productIdCache = new Map<PaidPlanKey, string>();
const priceIdCache = new Map<string, string>();

function getCatalogCacheKey(plan: PaidPlanKey, billingCycle: BillingCycle) {
  return `${plan}:${billingCycle}`;
}

function normalizePaddleEnvironment(value: string | undefined): PaddleEnvironment {
  return value?.toLowerCase().trim() === "production" ? "production" : "sandbox";
}

export function getPaddleEnvironment() {
  return normalizePaddleEnvironment(process.env.PADDLE_ENVIRONMENT);
}

export function getPaddleVendorId() {
  const vendorId = process.env.PADDLE_VENDOR_ID?.trim();

  if (!vendorId) {
    throw new Error("Missing PADDLE_VENDOR_ID.");
  }

  return vendorId;
}

function getPaddleApiKey() {
  const apiKey = process.env.PADDLE_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("Missing PADDLE_API_KEY.");
  }

  return apiKey;
}

function getPaddleWebhookSecret() {
  const secret = process.env.PADDLE_WEBHOOK_SECRET?.trim();

  if (!secret) {
    throw new Error("Missing PADDLE_WEBHOOK_SECRET.");
  }

  return secret;
}

function getPaddleTaxCategory() {
  return process.env.PADDLE_TAX_CATEGORY?.trim() || DEFAULT_TAX_CATEGORY;
}

function toMinorUnits(amount: number) {
  return String(Math.round(amount * 100));
}

function isMatchingCatalogMetadata(
  customData: Record<string, unknown> | null | undefined,
  plan: PaidPlanKey,
  billingCycle?: BillingCycle
) {
  if (!customData) {
    return false;
  }

  if (customData.app !== "sitepulse") {
    return false;
  }

  if (customData.internalPlan !== plan) {
    return false;
  }

  if (billingCycle && customData.billingCycle !== billingCycle) {
    return false;
  }

  return true;
}

async function paddleRequest<T>(
  path: string,
  input: {
    method?: "GET" | "POST" | "PATCH";
    body?: Record<string, unknown>;
  } = {}
) {
  const response = await fetch(path.startsWith("http") ? path : `https://api.paddle.com${path}`, {
    method: input.method ?? "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${getPaddleApiKey()}`,
      "Content-Type": "application/json"
    },
    body: input.body ? JSON.stringify(input.body) : undefined,
    cache: "no-store"
  }).catch((error) => {
    throw new Error(
      `Unable to reach Paddle ${input.method ?? "GET"} ${path}: ${
        error instanceof Error ? error.message : "Unknown network error."
      }`
    );
  });

  if (!response.ok) {
    const raw = await response.text();

    try {
      const parsed = JSON.parse(raw) as {
        error?: {
          detail?: string;
          type?: string;
        };
      };
      const detail = parsed.error?.detail ?? parsed.error?.type;
      throw new Error(detail ? `Paddle API error: ${detail}` : `Paddle API error: ${raw}`);
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }

      throw new Error(`Paddle API error: ${raw}`);
    }
  }

  return (await response.json()) as T;
}

async function listProducts() {
  const response = await paddleRequest<PaddleListResponse<PaddleProduct>>(
    "/products?status=active&per_page=100"
  );

  return response.data;
}

async function listPrices(productId: string) {
  const response = await paddleRequest<PaddleListResponse<PaddlePrice>>(
    `/prices?status=active&recurring=true&product_id=${encodeURIComponent(productId)}&per_page=100`
  );

  return response.data;
}

async function listClientTokens() {
  const response = await paddleRequest<PaddleListResponse<PaddleClientToken>>(
    "/client-tokens?status=active&per_page=100"
  );

  return response.data;
}

async function createClientToken() {
  const response = await paddleRequest<PaddleApiResponse<PaddleClientToken>>("/client-tokens", {
    method: "POST",
    body: {
      name: CLIENT_TOKEN_NAME,
      description: CLIENT_TOKEN_DESCRIPTION
    }
  });

  return response.data;
}

async function createProduct(plan: PaidPlanKey) {
  const definition = PRODUCT_DEFINITIONS[plan];

  try {
    const response = await paddleRequest<PaddleApiResponse<PaddleProduct>>("/products", {
      method: "POST",
      body: {
        name: definition.productName,
        description: definition.description,
        tax_category: getPaddleTaxCategory(),
        type: "standard",
        custom_data: {
          app: "sitepulse",
          internalPlan: plan
        }
      }
    });

    return response.data;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create Paddle product.";

    if (/tax category/i.test(message)) {
      throw new Error(
        `${message} Set PADDLE_TAX_CATEGORY to a tax category approved in your Paddle account.`
      );
    }

    throw error;
  }
}

async function createPrice(plan: PaidPlanKey, billingCycle: BillingCycle, productId: string) {
  const snapshot = getPlanPricing(plan, billingCycle);
  const response = await paddleRequest<PaddleApiResponse<PaddlePrice>>("/prices", {
    method: "POST",
    body: {
      product_id: productId,
      name: getPaddlePlanName(plan, billingCycle),
      description: `${snapshot.planName} sale price`,
      unit_price: {
        amount: toMinorUnits(snapshot.salePrice),
        currency_code: "USD"
      },
      billing_cycle: {
        interval: billingCycle === "yearly" ? "year" : "month",
        frequency: 1
      },
      tax_mode: "account_setting",
      quantity: {
        minimum: 1,
        maximum: 1
      },
      custom_data: {
        app: "sitepulse",
        internalPlan: plan,
        billingCycle,
        planName: snapshot.planName,
        originalPrice: snapshot.originalPrice,
        salePrice: snapshot.salePrice
      }
    }
  });

  return response.data;
}

async function getOrCreateProductId(plan: PaidPlanKey) {
  const cached = productIdCache.get(plan);

  if (cached) {
    return cached;
  }

  const products = await listProducts();
  const existing =
    products.find((product) => isMatchingCatalogMetadata(product.custom_data, plan)) ??
    products.find((product) => product.name === PRODUCT_DEFINITIONS[plan].productName);

  if (existing) {
    productIdCache.set(plan, existing.id);
    return existing.id;
  }

  const created = await createProduct(plan);
  productIdCache.set(plan, created.id);
  return created.id;
}

async function getOrCreatePriceId(plan: PaidPlanKey, billingCycle: BillingCycle) {
  const cacheKey = getCatalogCacheKey(plan, billingCycle);
  const cached = priceIdCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const productId = await getOrCreateProductId(plan);
  const snapshot = getPlanPricing(plan, billingCycle);
  const prices = await listPrices(productId);
  const expectedAmount = toMinorUnits(snapshot.salePrice);
  const existing =
    prices.find((price) => {
      const interval = billingCycle === "yearly" ? "year" : "month";
      return (
        isMatchingCatalogMetadata(price.custom_data, plan, billingCycle) &&
        price.billing_cycle?.interval === interval &&
        price.billing_cycle.frequency === 1 &&
        price.unit_price.amount === expectedAmount
      );
    }) ??
    prices.find((price) => price.name === getPaddlePlanName(plan, billingCycle));

  if (existing) {
    priceIdCache.set(cacheKey, existing.id);
    return existing.id;
  }

  const created = await createPrice(plan, billingCycle, productId);
  priceIdCache.set(cacheKey, created.id);
  return created.id;
}

export async function getPaddleClientToken() {
  if (process.env.PADDLE_CLIENT_TOKEN?.trim()) {
    return process.env.PADDLE_CLIENT_TOKEN.trim();
  }

  if (cachedClientToken) {
    return cachedClientToken;
  }

  const existing = (await listClientTokens()).find((token) => token.name === CLIENT_TOKEN_NAME);
  const created = existing?.token ? existing : await createClientToken();

  cachedClientToken = created.token;
  return created.token;
}

export async function getPaddleCheckoutConfig(input: {
  plan: PaidPlanKey;
  billingCycle: BillingCycle;
  userId: string;
}) {
  const snapshot = getPlanPricing(input.plan, input.billingCycle);
  const priceId = await getOrCreatePriceId(input.plan, input.billingCycle);

  return {
    environment: getPaddleEnvironment(),
    vendorId: getPaddleVendorId(),
    clientToken: await getPaddleClientToken(),
    priceId,
    successUrl: `${getBaseUrl()}/dashboard/billing?paddle=success`,
    cancelUrl: `${getBaseUrl()}/dashboard/billing?paddle=canceled`,
    plan: input.plan,
    billingCycle: input.billingCycle,
    planName: snapshot.planName,
    originalPrice: snapshot.originalPrice,
    salePrice: snapshot.salePrice,
    customData: {
      userId: input.userId,
      plan: input.plan,
      billingCycle: input.billingCycle,
      planName: snapshot.planName,
      originalPrice: snapshot.originalPrice,
      salePrice: snapshot.salePrice,
      source: "sitepulse-dashboard"
    } satisfies PaddleCheckoutCustomData
  };
}

export async function getPaddleSubscription(subscriptionId: string) {
  const response = await paddleRequest<PaddleApiResponse<PaddleSubscription>>(
    `/subscriptions/${encodeURIComponent(subscriptionId)}`
  );

  return response.data;
}

export async function getPaddleTransaction(transactionId: string) {
  const response = await paddleRequest<PaddleApiResponse<PaddleTransaction>>(
    `/transactions/${encodeURIComponent(transactionId)}?include=customer`
  );

  return response.data;
}

export async function createPaddlePortalSession(input: {
  customerId: string;
  subscriptionId?: string | null;
}) {
  const response = await paddleRequest<PaddleApiResponse<PaddlePortalSession>>(
    `/customers/${encodeURIComponent(input.customerId)}/portal-sessions`,
    {
      method: "POST",
      body:
        input.subscriptionId
          ? {
              subscription_ids: [input.subscriptionId]
            }
          : {}
    }
  );

  return response.data;
}

export function mapPaddleStatus(status: string): string {
  const value = status.toLowerCase();

  if (value === "active" || value === "trialing" || value === "paused" || value === "past_due") {
    return value;
  }

  if (value === "canceled") {
    return "cancelled";
  }

  return "inactive";
}

export function parsePaddleSelection(
  customData: Record<string, unknown> | null | undefined
): {
  plan: PaidPlanKey;
  billingCycle: BillingCycle;
  planName: string;
  originalPrice: number;
  salePrice: number;
} | null {
  if (!customData) {
    return null;
  }

  const rawPlan = customData.plan;
  const rawBillingCycle = customData.billingCycle;

  if (
    (rawPlan !== "starter" && rawPlan !== "agency") ||
    (rawBillingCycle !== "monthly" && rawBillingCycle !== "yearly")
  ) {
    return null;
  }

  const snapshot = getPlanPricing(rawPlan, rawBillingCycle);

  return {
    plan: rawPlan,
    billingCycle: rawBillingCycle,
    planName:
      typeof customData.planName === "string" && customData.planName.trim()
        ? customData.planName
        : snapshot.planName,
    originalPrice:
      typeof customData.originalPrice === "number" ? customData.originalPrice : snapshot.originalPrice,
    salePrice: typeof customData.salePrice === "number" ? customData.salePrice : snapshot.salePrice
  };
}

export async function resolveSelectionFromPriceId(priceId: string) {
  for (const plan of ["starter", "agency"] as PaidPlanKey[]) {
    for (const billingCycle of ["monthly", "yearly"] as BillingCycle[]) {
      const knownPriceId = await getOrCreatePriceId(plan, billingCycle);

      if (knownPriceId === priceId) {
        const snapshot = getPlanPricing(plan, billingCycle);
        return {
          plan,
          billingCycle,
          planName: snapshot.planName,
          originalPrice: snapshot.originalPrice,
          salePrice: snapshot.salePrice
        };
      }
    }
  }

  return null;
}

function timingSafeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function verifyPaddleWebhookSignature(rawBody: string, signatureHeader: string | null) {
  const secret = getPaddleWebhookSecret();

  if (!signatureHeader) {
    throw new Error("Missing Paddle-Signature header.");
  }

  const parts = signatureHeader.split(";").reduce<Record<string, string>>((accumulator, part) => {
    const [rawKey, rawValue] = part.trim().split("=");

    if (rawKey && rawValue) {
      accumulator[rawKey] = rawValue;
    }

    return accumulator;
  }, {});

  const timestamp = parts.ts;
  const providedSignature = parts.h1;

  if (!timestamp || !providedSignature) {
    throw new Error("Malformed Paddle-Signature header.");
  }

  const ageInMs = Math.abs(Date.now() - Number(timestamp) * 1000);
  if (!Number.isFinite(ageInMs) || ageInMs > 5 * 60 * 1000) {
    throw new Error("Stale Paddle webhook signature.");
  }

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}:${rawBody}`, "utf8")
    .digest("hex");

  if (!timingSafeEqual(expectedSignature, providedSignature)) {
    throw new Error("Invalid Paddle webhook signature.");
  }

  return {
    timestamp: Number(timestamp)
  };
}

export function getSelectionFromPlan(input: {
  plan: PlanKey;
  billingCycle: BillingCycle | null | undefined;
}) {
  if (!isPaidPlan(input.plan) || !input.billingCycle) {
    return null;
  }

  const snapshot = getPlanPricing(input.plan, input.billingCycle);

  return {
    plan: input.plan,
    billingCycle: input.billingCycle,
    planName: snapshot.planName,
    originalPrice: snapshot.originalPrice,
    salePrice: snapshot.salePrice
  };
}
