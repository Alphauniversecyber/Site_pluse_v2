"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { saveBillingPlanPrices } from "@/lib/billing-config";
import { PAID_PLAN_KEYS, type PaidPlanKey } from "@/lib/billing";
import { requireAdminPageAccess } from "@/lib/admin/auth";
import type { BillingCycle } from "@/types";

type AdminBillingActionResult = {
  ok: boolean;
  message: string;
};

const BILLING_CYCLES: BillingCycle[] = ["monthly", "yearly"];

function buildRedirectUrl(result: AdminBillingActionResult) {
  const params = new URLSearchParams();
  params.set("actionStatus", result.ok ? "success" : "failed");
  params.set("actionMessage", result.message);
  return `/admin/billing?${params.toString()}`;
}

function parsePriceField(formData: FormData, plan: PaidPlanKey, billingCycle: BillingCycle, field: "original_price" | "sale_price") {
  const fieldName = `${plan}_${billingCycle}_${field}`;
  const rawValue = String(formData.get(fieldName) ?? "").trim();

  if (!rawValue) {
    throw new Error(`Missing ${field.replace("_", " ")} for ${plan} ${billingCycle}.`);
  }

  const value = Number.parseFloat(rawValue);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Enter a valid positive price for ${plan} ${billingCycle}.`);
  }

  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export async function runAdminBillingPricingAction(formData: FormData) {
  requireAdminPageAccess();

  let result: AdminBillingActionResult;

  try {
    const rows = PAID_PLAN_KEYS.flatMap((plan) =>
      BILLING_CYCLES.map((billingCycle) => {
        const originalPrice = parsePriceField(formData, plan, billingCycle, "original_price");
        const salePrice = parsePriceField(formData, plan, billingCycle, "sale_price");

        if (salePrice > originalPrice) {
          throw new Error(
            `Sale price cannot be higher than the original price for ${plan} ${billingCycle}.`
          );
        }

        return {
          plan,
          billingCycle,
          originalPrice,
          salePrice
        };
      })
    );

    await saveBillingPlanPrices(rows);

    revalidatePath("/admin/billing");
    revalidatePath("/dashboard/billing");
    revalidatePath("/pricing");
    revalidatePath("/");

    result = {
      ok: true,
      message: "Billing prices updated. User billing and pricing pages now use the new values."
    };
  } catch (error) {
    result = {
      ok: false,
      message: error instanceof Error ? error.message : "Unable to update billing prices."
    };
  }

  redirect(buildRedirectUrl(result));
}
