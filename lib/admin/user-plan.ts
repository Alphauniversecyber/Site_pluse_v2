import { getPlanPricing, type BillingPlanCatalog } from "@/lib/billing";
import type { AdminUserState } from "@/lib/admin/format";
import type { BillingCycle, PlanKey } from "@/types";

export type AdminPlanOverrideValue =
  | "trial"
  | "pro_monthly"
  | "pro_yearly"
  | "growth_monthly"
  | "growth_yearly";

export function getAdminPlanOverrideLabel(value: AdminPlanOverrideValue) {
  if (value === "trial") {
    return "Trial";
  }

  if (value === "growth_yearly") {
    return "Growth Yearly";
  }

  if (value === "growth_monthly") {
    return "Growth Monthly";
  }

  if (value === "pro_yearly") {
    return "Pro Yearly";
  }

  if (value === "pro_monthly") {
    return "Pro Monthly";
  }

  return "Trial";
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

export function getAdminDisplayedPlanLabel(
  plan: PlanKey,
  billingCycle: BillingCycle | null | undefined,
  state: AdminUserState
) {
  if (state === "trial" || state === "expired") {
    return "Trial";
  }

  return getAdminCurrentPlanLabel(plan, billingCycle);
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
  billingCycle: BillingCycle | null | undefined,
  state?: AdminUserState
): AdminPlanOverrideValue | null {
  if (state === "trial" || state === "expired") {
    return "trial";
  }

  if (plan === "agency" && billingCycle === "yearly") {
    return "pro_yearly";
  }

  if (plan === "agency" && billingCycle === "monthly") {
    return "pro_monthly";
  }

  if (plan === "starter" && billingCycle === "yearly") {
    return "growth_yearly";
  }

  if (plan === "starter" && billingCycle === "monthly") {
    return "growth_monthly";
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
  if (value === "trial") {
    return {
      plan: "starter",
      billingCycle: null,
      planName: "Trial",
      originalPrice: 0,
      salePrice: 0
    };
  }

  const plan = value.startsWith("growth_") ? "starter" : "agency";
  const billingCycle = value.endsWith("_yearly") ? "yearly" : "monthly";
  const pricing = getPlanPricing(plan, billingCycle, billingPlans);

  return {
    plan,
    billingCycle,
    planName: pricing.planName,
    originalPrice: pricing.originalPrice,
    salePrice: pricing.salePrice
  };
}
