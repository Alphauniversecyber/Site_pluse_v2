import type { BillingCycle, PlanKey } from "@/types";

export type PaidPlanKey = Exclude<PlanKey, "free">;

export interface PlanBillingDefinition {
  displayName: string;
  internalPlan: PlanKey;
  monthlyPrice: number;
  yearlyPrice: number;
  yearlySavingsLabel?: string;
  yearlyValueCopy?: string;
  marketingBadge?: string;
  trialDays: number;
  audience: string;
}

export const BILLING_PLANS: Record<PlanKey, PlanBillingDefinition> = {
  free: {
    displayName: "Starter",
    internalPlan: "free",
    monthlyPrice: 0,
    yearlyPrice: 0,
    marketingBadge: "For testing value",
    trialDays: 0,
    audience: "For freelancers testing value"
  },
  starter: {
    displayName: "Growth",
    internalPlan: "starter",
    monthlyPrice: 49,
    yearlyPrice: 468,
    yearlySavingsLabel: "Save 20%",
    yearlyValueCopy: "Save $120/year — close 1 extra client and it pays for itself",
    marketingBadge: "Most popular · Trusted by 500+ agencies",
    trialDays: 14,
    audience: "For agencies managing multiple clients"
  },
  agency: {
    displayName: "Pro",
    internalPlan: "agency",
    monthlyPrice: 149,
    yearlyPrice: 1428,
    yearlySavingsLabel: "Save 20%",
    yearlyValueCopy: "Save $360/year — one retained client covers this many times over",
    marketingBadge: "For serious scale",
    trialDays: 14,
    audience: "For serious agencies scaling operations"
  }
};

export function getPlanAmount(plan: PlanKey, billingCycle: BillingCycle) {
  const definition = BILLING_PLANS[plan];
  return billingCycle === "yearly" ? definition.yearlyPrice : definition.monthlyPrice;
}

export function getDisplayedMonthlyEquivalent(plan: PlanKey, billingCycle: BillingCycle) {
  const definition = BILLING_PLANS[plan];
  return billingCycle === "yearly" ? Math.round(definition.yearlyPrice / 12) : definition.monthlyPrice;
}

export function getYearlyBillingCopy(plan: PlanKey) {
  return `Billed ${formatUsdPrice(BILLING_PLANS[plan].yearlyPrice)}/year`;
}

export function isPaidPlan(plan: PlanKey): plan is PaidPlanKey {
  return plan !== "free";
}

export function formatUsdPrice(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(amount);
}

export function getBillingLine(plan: PlanKey, billingCycle: BillingCycle) {
  return `${formatUsdPrice(getPlanAmount(plan, billingCycle))} / ${billingCycle === "yearly" ? "year" : "month"}`;
}

export function getPayPalPlanName(plan: PaidPlanKey, billingCycle: BillingCycle) {
  const definition = BILLING_PLANS[plan];
  return `SitePulse ${definition.displayName} ${billingCycle === "yearly" ? "Yearly" : "Monthly"}`;
}
