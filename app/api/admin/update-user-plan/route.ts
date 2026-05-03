import { apiError, apiSuccess } from "@/lib/api";
import { requireAdminApiAuthorization } from "@/lib/admin/auth";
import { getAdminUserState } from "@/lib/admin/format";
import {
  getAdminDisplayedPlanLabel,
  getAdminOverrideSelectionFromCurrentPlan,
  resolveAdminPlanOverride,
  type AdminPlanOverrideValue
} from "@/lib/admin/user-plan";
import { getBillingPlans } from "@/lib/billing-config";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { adminUpdateUserPlanSchema } from "@/lib/validation";
import type { BillingCycle, PlanKey, SubscriptionStatus, UserProfile } from "@/types";

export const runtime = "nodejs";

type AdminManagedUserRow = Pick<
  UserProfile,
  | "id"
  | "email"
  | "plan"
  | "billing_cycle"
  | "subscription_price"
  | "subscription_status"
  | "next_billing_date"
  | "last_payment_date"
  | "trial_end_date"
  | "trial_ends_at"
  | "is_trial"
  | "paddle_customer_id"
  | "paddle_subscription_id"
  | "plan_override"
  | "plan_override_counts_as_revenue"
>;

type ManagedSubscriptionRow = {
  id: string;
  user_id: string;
  email: string;
  plan_name: string;
  plan_tier: "starter" | "agency";
  billing_interval: BillingCycle;
  original_price: number;
  sale_price: number;
  paddle_customer_id: string | null;
  paddle_subscription_id: string;
  status: SubscriptionStatus;
  next_billing_date: string | null;
  last_payment_date: string | null;
  updated_at: string;
};

const MANUAL_SUBSCRIPTION_PREFIX = "manual_override:";
const TRIAL_DURATION_MS = 14 * 24 * 60 * 60 * 1000;
const ADMIN_MANUAL_REVENUE_FALLBACKS: Record<Exclude<AdminPlanOverrideValue, "trial">, number> = {
  pro_monthly: 49,
  pro_yearly: 470,
  growth_monthly: 99,
  growth_yearly: 950
};

function getManualSubscriptionId(userId: string) {
  return `${MANUAL_SUBSCRIPTION_PREFIX}${userId}`;
}

function getRevenueAmount(plan: Exclude<AdminPlanOverrideValue, "trial">, salePrice: number) {
  if (salePrice > 0) {
    return salePrice;
  }

  return ADMIN_MANUAL_REVENUE_FALLBACKS[plan];
}

async function loadManagedUser(userId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("users")
    .select(
      "id,email,plan,billing_cycle,subscription_price,subscription_status,next_billing_date,last_payment_date,trial_end_date,trial_ends_at,is_trial,paddle_customer_id,paddle_subscription_id,plan_override,plan_override_counts_as_revenue"
    )
    .eq("id", userId)
    .maybeSingle<AdminManagedUserRow>();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

async function loadLatestSubscription(userId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("subscriptions")
    .select(
      "id,user_id,email,plan_name,plan_tier,billing_interval,original_price,sale_price,paddle_customer_id,paddle_subscription_id,status,next_billing_date,last_payment_date,updated_at"
    )
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle<ManagedSubscriptionRow>();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

async function syncSubscriptionMirror(input: {
  user: AdminManagedUserRow;
  overridePlan: AdminPlanOverrideValue;
  plan: PlanKey;
  planName: string;
  billingCycle: BillingCycle | null;
  originalPrice: number;
  salePrice: number;
  countAsRevenue: boolean;
  nowIso: string;
}) {
  const admin = createSupabaseAdminClient();
  const existing = await loadLatestSubscription(input.user.id);

  if (input.overridePlan === "trial") {
    if (!existing) {
      return null;
    }

    const { error } = await admin
      .from("subscriptions")
      .update({
        email: input.user.email,
        status: "cancelled",
        next_billing_date: null
      })
      .eq("id", existing.id);

    if (error) {
      throw new Error(error.message);
    }

    return existing.id;
  }

  const payload = {
    user_id: input.user.id,
    email: input.user.email,
    plan_name: input.planName,
    plan_tier: input.plan === "starter" ? ("starter" as const) : ("agency" as const),
    billing_interval: input.billingCycle ?? "monthly",
    original_price: input.originalPrice,
    sale_price: input.salePrice,
    paddle_customer_id: existing?.paddle_customer_id ?? input.user.paddle_customer_id ?? null,
    paddle_subscription_id:
      existing?.paddle_subscription_id ?? getManualSubscriptionId(input.user.id),
    status: "active" as const,
    next_billing_date: null,
    last_payment_date: input.countAsRevenue ? input.nowIso : existing?.last_payment_date ?? null
  };

  const { error } = existing
    ? await admin.from("subscriptions").update(payload).eq("id", existing.id)
    : await admin.from("subscriptions").insert(payload);

  if (error) {
    throw new Error(error.message);
  }

  return existing?.id ?? null;
}

export async function POST(request: Request) {
  const authError = requireAdminApiAuthorization(request);
  if (authError) {
    return authError;
  }

  const body = await request.json().catch(() => null);
  const parsed = adminUpdateUserPlanSchema.safeParse(body);

  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid plan update request.", 422);
  }

  try {
    const admin = createSupabaseAdminClient();
    const user = await loadManagedUser(parsed.data.userId);

    if (!user) {
      return apiError("User not found.", 404);
    }

    const billingPlans = await getBillingPlans();
    const resolved = resolveAdminPlanOverride(parsed.data.plan, billingPlans);
    const nowIso = new Date().toISOString();
    const isTrialReset = parsed.data.plan === "trial";
    const trialEndsAt = isTrialReset ? new Date(Date.now() + TRIAL_DURATION_MS).toISOString() : null;
    const lastPaymentDate = isTrialReset
      ? null
      : parsed.data.countAsRevenue
        ? nowIso
        : user.last_payment_date ?? null;
    const subscriptionStatus = isTrialReset ? "trialing" : "active";

    const { error: userError } = await admin
      .from("users")
      .update({
        plan: resolved.plan,
        plan_override: true,
        plan_override_counts_as_revenue: isTrialReset ? false : parsed.data.countAsRevenue,
        billing_cycle: resolved.billingCycle,
        subscription_price: isTrialReset ? null : resolved.salePrice,
        subscription_status: subscriptionStatus,
        next_billing_date: null,
        last_payment_date: lastPaymentDate,
        is_trial: isTrialReset,
        trial_end_date: trialEndsAt,
        trial_ends_at: trialEndsAt
      })
      .eq("id", user.id);

    if (userError) {
      throw new Error(userError.message);
    }

    await syncSubscriptionMirror({
      user,
      overridePlan: parsed.data.plan,
      plan: resolved.plan,
      planName: resolved.planName,
      billingCycle: resolved.billingCycle,
      originalPrice: resolved.originalPrice,
      salePrice: resolved.salePrice,
      countAsRevenue: parsed.data.countAsRevenue,
      nowIso
    });

    let revenueEntryCreated = false;

    if (parsed.data.countAsRevenue && parsed.data.plan !== "trial") {
      const { error: revenueError } = await admin.from("manual_revenue_entries").insert({
        user_id: user.id,
        plan: parsed.data.plan,
        amount: getRevenueAmount(parsed.data.plan, resolved.salePrice),
        note: parsed.data.note?.trim() || null,
        created_at: nowIso
      });

      if (revenueError) {
        throw new Error(revenueError.message);
      }

      revenueEntryCreated = true;
    }

    const responsePlan = resolved.plan;
    const responseBillingCycle = resolved.billingCycle;
    const responseState = getAdminUserState({
      is_trial: isTrialReset,
      trial_ends_at: trialEndsAt,
      subscription_status: subscriptionStatus,
      plan: responsePlan
    });

    return apiSuccess({
      userId: user.id,
      plan: responsePlan,
      billingCycle: responseBillingCycle,
      currentPlanLabel: getAdminDisplayedPlanLabel(responsePlan, responseBillingCycle, responseState),
      selectedPlan: getAdminOverrideSelectionFromCurrentPlan(
        responsePlan,
        responseBillingCycle,
        responseState
      ),
      state: responseState,
      subscriptionStatus: subscriptionStatus as SubscriptionStatus,
      subscriptionPrice: isTrialReset ? null : resolved.salePrice,
      nextBillingDate: null,
      trialEndsAt,
      planOverride: true,
      planOverrideCountsAsRevenue: isTrialReset ? false : parsed.data.countAsRevenue,
      revenueEntryCreated
    });
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "Unable to update the user plan.",
      500
    );
  }
}
