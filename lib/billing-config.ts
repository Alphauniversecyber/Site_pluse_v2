import "server-only";

import { cache } from "react";

import {
  BILLING_PLANS,
  PAID_PLAN_KEYS,
  type BillingPlanCatalog,
  type PaidPlanKey
} from "@/lib/billing";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import type { BillingCycle } from "@/types";

type BillingPlanPriceRow = {
  plan_key: PaidPlanKey;
  billing_cycle: BillingCycle;
  original_price: number | string;
  sale_price: number | string;
};

type BillingPlansState = {
  plans: BillingPlanCatalog;
  overrideKeys: Set<string>;
};

function buildOverrideKey(plan: PaidPlanKey, billingCycle: BillingCycle) {
  return `${plan}:${billingCycle}`;
}

function toNumber(value: number | string) {
  if (typeof value === "number") {
    return value;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function cloneDefaultPlans(): BillingPlanCatalog {
  return {
    free: { ...BILLING_PLANS.free },
    starter: { ...BILLING_PLANS.starter },
    agency: { ...BILLING_PLANS.agency }
  };
}

function isMissingTableError(message: string) {
  return /billing_plan_prices/i.test(message) && /(does not exist|not find the table|schema cache)/i.test(message);
}

export const getBillingPlansState = cache(async (): Promise<BillingPlansState> => {
  const admin = createSupabaseAdminClient();
  const defaults = cloneDefaultPlans();

  try {
    const { data, error } = await admin
      .from("billing_plan_prices")
      .select("plan_key,billing_cycle,original_price,sale_price");

    if (error) {
      if (isMissingTableError(error.message)) {
        return {
          plans: defaults,
          overrideKeys: new Set()
        };
      }

      throw new Error(error.message);
    }

    const overrideKeys = new Set<string>();

    for (const row of (data ?? []) as BillingPlanPriceRow[]) {
      const plan = defaults[row.plan_key];
      if (!plan) {
        continue;
      }

      const originalPrice = toNumber(row.original_price);
      const salePrice = toNumber(row.sale_price);

      if (row.billing_cycle === "monthly") {
        plan.monthlyOriginalPrice = originalPrice;
        plan.monthlySalePrice = salePrice;
      } else {
        plan.yearlyOriginalPrice = originalPrice;
        plan.yearlySalePrice = salePrice;
      }

      overrideKeys.add(buildOverrideKey(row.plan_key, row.billing_cycle));
    }

    return {
      plans: defaults,
      overrideKeys
    };
  } catch {
    return {
      plans: defaults,
      overrideKeys: new Set()
    };
  }
});

export async function getBillingPlans() {
  return (await getBillingPlansState()).plans;
}

export async function hasBillingPlanPriceOverride(plan: PaidPlanKey, billingCycle: BillingCycle) {
  return (await getBillingPlansState()).overrideKeys.has(buildOverrideKey(plan, billingCycle));
}

export async function saveBillingPlanPrices(
  rows: Array<{
    plan: PaidPlanKey;
    billingCycle: BillingCycle;
    originalPrice: number;
    salePrice: number;
  }>
) {
  const admin = createSupabaseAdminClient();
  const payload = rows.map((row) => ({
    plan_key: row.plan,
    billing_cycle: row.billingCycle,
    original_price: row.originalPrice,
    sale_price: row.salePrice
  }));

  const { error } = await admin.from("billing_plan_prices").upsert(payload, {
    onConflict: "plan_key,billing_cycle"
  });

  if (error) {
    if (isMissingTableError(error.message)) {
      throw new Error(
        "Billing price storage is not available yet. Run the latest Supabase schema migration for billing_plan_prices first."
      );
    }

    throw new Error(error.message);
  }
}

export function getPaidPlanEntries() {
  return PAID_PLAN_KEYS;
}
