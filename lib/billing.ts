import type { BillingCycle, PlanKey } from "@/types";

export type PaidPlanKey = Exclude<PlanKey, "free">;

export interface PlanBillingDefinition {
  displayName: string;
  internalPlan: PlanKey;
  monthlyOriginalPrice: number;
  monthlySalePrice: number;
  yearlyOriginalPrice: number;
  yearlySalePrice: number;
  yearlySavingsLabel?: string;
  marketingBadge?: string;
  trialDays: number;
  audience: string;
}

export interface PlanPriceSnapshot {
  plan: PlanKey;
  billingCycle: BillingCycle;
  displayName: string;
  planName: string;
  originalPrice: number;
  salePrice: number;
  monthlyEquivalent: number;
}

export const BILLING_PLANS: Record<PlanKey, PlanBillingDefinition> = {
  free: {
    displayName: "Starter",
    internalPlan: "free",
    monthlyOriginalPrice: 0,
    monthlySalePrice: 0,
    yearlyOriginalPrice: 0,
    yearlySalePrice: 0,
    marketingBadge: "For testing value",
    trialDays: 0,
    audience: "For freelancers testing value"
  },
  starter: {
    displayName: "Growth",
    internalPlan: "starter",
    monthlyOriginalPrice: 49,
    monthlySalePrice: 19,
    yearlyOriginalPrice: 468,
    yearlySalePrice: 180,
    yearlySavingsLabel: "Save 21%",
    marketingBadge: "\uD83D\uDD12 Founding Member Sale",
    trialDays: 14,
    audience: "For agencies managing multiple clients"
  },
  agency: {
    displayName: "Pro",
    internalPlan: "agency",
    monthlyOriginalPrice: 149,
    monthlySalePrice: 59,
    yearlyOriginalPrice: 1428,
    yearlySalePrice: 564,
    yearlySavingsLabel: "Save 20%",
    marketingBadge: "\uD83D\uDD12 Founding Member Sale",
    trialDays: 14,
    audience: "For serious agencies scaling operations"
  }
};

export function isPaidPlan(plan: PlanKey): plan is PaidPlanKey {
  return plan !== "free";
}

export function getPlanPricing(plan: PlanKey, billingCycle: BillingCycle): PlanPriceSnapshot {
  const definition = BILLING_PLANS[plan];
  const originalPrice =
    billingCycle === "yearly" ? definition.yearlyOriginalPrice : definition.monthlyOriginalPrice;
  const salePrice =
    billingCycle === "yearly" ? definition.yearlySalePrice : definition.monthlySalePrice;

  return {
    plan,
    billingCycle,
    displayName: definition.displayName,
    planName:
      plan === "free"
        ? definition.displayName
        : `${definition.displayName} ${billingCycle === "yearly" ? "Yearly" : "Monthly"}`,
    originalPrice,
    salePrice,
    monthlyEquivalent: billingCycle === "yearly" ? Math.round(salePrice / 12) : salePrice
  };
}

export function getPlanAmount(plan: PlanKey, billingCycle: BillingCycle) {
  return getPlanPricing(plan, billingCycle).salePrice;
}

export function getPlanOriginalAmount(plan: PlanKey, billingCycle: BillingCycle) {
  return getPlanPricing(plan, billingCycle).originalPrice;
}

export function getDisplayedMonthlyEquivalent(plan: PlanKey, billingCycle: BillingCycle) {
  return getPlanPricing(plan, billingCycle).monthlyEquivalent;
}

export function getDisplayedOriginalMonthlyEquivalent(plan: PlanKey, billingCycle: BillingCycle) {
  if (billingCycle === "monthly") {
    return BILLING_PLANS[plan].monthlyOriginalPrice;
  }

  return Math.round(BILLING_PLANS[plan].yearlyOriginalPrice / 12);
}

export function getMonthlySavings(plan: PlanKey, billingCycle: BillingCycle) {
  if (plan === "free") {
    return 0;
  }

  return getDisplayedOriginalMonthlyEquivalent(plan, billingCycle) - getDisplayedMonthlyEquivalent(plan, billingCycle);
}

export function getYearlyBillingCopy(plan: PlanKey) {
  return `billed as ${formatUsdPrice(BILLING_PLANS[plan].yearlySalePrice)}/yr`;
}

export function formatUsdPrice(amount: number, options?: { maximumFractionDigits?: number }) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: options?.maximumFractionDigits ?? 0
  }).format(amount);
}

export function getBillingLine(plan: PlanKey, billingCycle: BillingCycle) {
  return `${formatUsdPrice(getPlanAmount(plan, billingCycle))} / ${billingCycle === "yearly" ? "year" : "month"}`;
}

export function getOriginalBillingLine(plan: PlanKey, billingCycle: BillingCycle) {
  return `${formatUsdPrice(getPlanOriginalAmount(plan, billingCycle))} / ${billingCycle === "yearly" ? "year" : "month"}`;
}

export function getPaddlePlanName(plan: PaidPlanKey, billingCycle: BillingCycle) {
  return getPlanPricing(plan, billingCycle).planName;
}
