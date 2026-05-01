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

export type BillingPlanCatalog = Record<PlanKey, PlanBillingDefinition>;

export interface PlanPriceSnapshot {
  plan: PlanKey;
  billingCycle: BillingCycle;
  displayName: string;
  planName: string;
  originalPrice: number;
  salePrice: number;
  monthlyEquivalent: number;
}

export const BILLING_PLAN_KEYS = ["free", "starter", "agency"] as const satisfies readonly PlanKey[];
export const PAID_PLAN_KEYS = ["starter", "agency"] as const satisfies readonly PaidPlanKey[];

export const BILLING_PLANS: BillingPlanCatalog = {
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
    yearlySalePrice: 187,
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
    yearlySalePrice: 571,
    marketingBadge: "\uD83D\uDD12 Founding Member Sale",
    trialDays: 14,
    audience: "For serious agencies scaling operations"
  }
};

function roundCurrency(amount: number) {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

function getPlanCatalog(plans?: BillingPlanCatalog) {
  return plans ?? BILLING_PLANS;
}

export function isPaidPlan(plan: PlanKey): plan is PaidPlanKey {
  return plan !== "free";
}

export function getPlanPricing(
  plan: PlanKey,
  billingCycle: BillingCycle,
  plans?: BillingPlanCatalog
): PlanPriceSnapshot {
  const definition = getPlanCatalog(plans)[plan];
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
    monthlyEquivalent: billingCycle === "yearly" ? roundCurrency(salePrice / 12) : salePrice
  };
}

export function getPlanAmount(plan: PlanKey, billingCycle: BillingCycle, plans?: BillingPlanCatalog) {
  return getPlanPricing(plan, billingCycle, plans).salePrice;
}

export function getPlanOriginalAmount(plan: PlanKey, billingCycle: BillingCycle, plans?: BillingPlanCatalog) {
  return getPlanPricing(plan, billingCycle, plans).originalPrice;
}

export function getDisplayedMonthlyEquivalent(
  plan: PlanKey,
  billingCycle: BillingCycle,
  plans?: BillingPlanCatalog
) {
  return getPlanPricing(plan, billingCycle, plans).monthlyEquivalent;
}

export function getDisplayedOriginalMonthlyEquivalent(
  plan: PlanKey,
  billingCycle: BillingCycle,
  plans?: BillingPlanCatalog
) {
  const catalog = getPlanCatalog(plans);
  if (billingCycle === "monthly") {
    return catalog[plan].monthlyOriginalPrice;
  }

  return roundCurrency(catalog[plan].yearlyOriginalPrice / 12);
}

export function getMonthlySavings(plan: PlanKey, billingCycle: BillingCycle, plans?: BillingPlanCatalog) {
  if (plan === "free") {
    return 0;
  }

  return roundCurrency(
    getDisplayedOriginalMonthlyEquivalent(plan, billingCycle, plans) -
      getDisplayedMonthlyEquivalent(plan, billingCycle, plans)
  );
}

export function calculateDiscountPercentage(originalPrice: number, salePrice: number) {
  if (originalPrice <= 0 || salePrice >= originalPrice) {
    return 0;
  }

  return Math.round(((originalPrice - salePrice) / originalPrice) * 100);
}

export function getDiscountPercentage(plan: PlanKey, billingCycle: BillingCycle, plans?: BillingPlanCatalog) {
  const snapshot = getPlanPricing(plan, billingCycle, plans);
  return calculateDiscountPercentage(snapshot.originalPrice, snapshot.salePrice);
}

export function hasPlanDiscount(plan: PlanKey, billingCycle: BillingCycle, plans?: BillingPlanCatalog) {
  return getDiscountPercentage(plan, billingCycle, plans) > 0;
}

export function getYearlySavingsLabel(plan: PlanKey, plans?: BillingPlanCatalog) {
  const discountPercentage = getDiscountPercentage(plan, "yearly", plans);
  return discountPercentage > 0 ? `Save ${discountPercentage}%` : undefined;
}

export function getYearlyBillingCopy(plan: PlanKey, plans?: BillingPlanCatalog) {
  return `Billed as ${formatUsdPrice(getPlanCatalog(plans)[plan].yearlySalePrice)}/yr`;
}

export function formatUsdPrice(amount: number, options?: { maximumFractionDigits?: number }) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: options?.maximumFractionDigits ?? 2
  }).format(amount);
}

export function getBillingLine(plan: PlanKey, billingCycle: BillingCycle, plans?: BillingPlanCatalog) {
  return `${formatUsdPrice(getPlanAmount(plan, billingCycle, plans))} / ${
    billingCycle === "yearly" ? "year" : "month"
  }`;
}

export function getOriginalBillingLine(plan: PlanKey, billingCycle: BillingCycle, plans?: BillingPlanCatalog) {
  return `${formatUsdPrice(getPlanOriginalAmount(plan, billingCycle, plans))} / ${
    billingCycle === "yearly" ? "year" : "month"
  }`;
}

export function getPaddlePlanName(plan: PaidPlanKey, billingCycle: BillingCycle, plans?: BillingPlanCatalog) {
  return getPlanPricing(plan, billingCycle, plans).planName;
}
