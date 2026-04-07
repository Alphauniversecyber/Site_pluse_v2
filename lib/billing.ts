import type { BillingCycle, PlanKey } from "@/types";

export type PaidPlanKey = Exclude<PlanKey, "free">;

export interface PlanBillingDefinition {
  displayName: string;
  internalPlan: PlanKey;
  monthlyPrice: number;
  yearlyPrice: number;
  yearlySavingsLabel?: string;
  trialDays: number;
  audience: string;
}

export const BILLING_PLANS: Record<PlanKey, PlanBillingDefinition> = {
  free: {
    displayName: "Starter",
    internalPlan: "free",
    monthlyPrice: 0,
    yearlyPrice: 0,
    trialDays: 0,
    audience: "For freelancers testing value"
  },
  starter: {
    displayName: "Growth",
    internalPlan: "starter",
    monthlyPrice: 49,
    yearlyPrice: 470,
    yearlySavingsLabel: "Save 20%",
    trialDays: 14,
    audience: "For agencies managing multiple clients"
  },
  agency: {
    displayName: "Pro",
    internalPlan: "agency",
    monthlyPrice: 149,
    yearlyPrice: 1430,
    yearlySavingsLabel: "Save 20%",
    trialDays: 14,
    audience: "For serious agencies scaling operations"
  }
};

export function getPlanAmount(plan: PlanKey, billingCycle: BillingCycle) {
  const definition = BILLING_PLANS[plan];
  return billingCycle === "yearly" ? definition.yearlyPrice : definition.monthlyPrice;
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
