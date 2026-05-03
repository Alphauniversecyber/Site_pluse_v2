import { getPlanPricing, type BillingPlanCatalog } from "@/lib/billing";
import type { BillingCycle, PlanKey } from "@/types";

export type AdminPlanOverrideValue = "free" | "pro_monthly" | "pro_yearly";

export function getAdminPlanOverrideLabel(value: AdminPlanOverrideValue) {
  if (value === "pro_yearly") {
    return "Pro Yearly";
  }

  if (value === "pro_monthly") {
    return "Pro Monthly";
  }

  return "Free";
}

export function getAdminCurrentPlanLabel(plan: PlanKey, billingCycle: BillingCycle | null | undefined) {
  if (plan === "agency") {
    return billingCycle === "yearly" ? "Pro Yearly" : "Pro Monthly";
  }

  if (plan === "starter") {
    if (billingCycle === "yearly") {
      return "Growth Yearly";
    }

    if (billingCycle === "monthly") {
      return "Growth Monthly";
    }

    return "Growth";
  }

  return "Free";
}

export function getAdminCurrentPlanBadgeVariant(plan: PlanKey, billingCycle: BillingCycle | null | undefined) {
  if (plan === "agency") {
    return billingCycle === "yearly" ? "success" : "default";
  }

  if (plan === "starter") {
    return "secondary";
  }

  return "outline";
}

export function getAdminOverrideSelectionFromCurrentPlan(
  plan: PlanKey,
  billingCycle: BillingCycle | null | undefined
): AdminPlanOverrideValue | null {
  if (plan === "free") {
    return "free";
  }

  if (plan === "agency" && billingCycle === "yearly") {
    return "pro_yearly";
  }

  if (plan === "agency" && billingCycle === "monthly") {
    return "pro_monthly";
  }

  return null;
}

export function resolveAdminPlanOverride(
  value: AdminPlanOverrideValue,
  billingPlans?: BillingPlanCatalog
): {
  plan: PlanKey;
  billingCycle: BillingCycle | null;
  planName: string;
  originalPrice: number;
  salePrice: number;
} {
  if (value === "free") {
    return {
      plan: "free",
      billingCycle: null,
      planName: "Free",
      originalPrice: 0,
      salePrice: 0
    };
  }

  const billingCycle = value === "pro_yearly" ? "yearly" : "monthly";
  const pricing = getPlanPricing("agency", billingCycle, billingPlans);

  return {
    plan: "agency",
    billingCycle,
    planName: pricing.planName,
    originalPrice: pricing.originalPrice,
    salePrice: pricing.salePrice
  };
}
