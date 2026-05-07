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

type SubscriptionMirrorMutation =
  | { mode: "noop"; subscriptionId: null }
  | { mode: "created"; subscriptionId: string }
  | { mode: "updated"; subscriptionId: string }
  | { mode: "cancelled"; subscriptionId: string };

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
}): Promise<SubscriptionMirrorMutation> {
  const admin = createSupabaseAdminClient();
  const existing = await loadLatestSubscription(input.user.id);

  if (input.overridePlan === "trial") {
    if (!existing) {
      return { mode: "noop", subscriptionId: null };
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

    return { mode: "cancelled", subscriptionId: existing.id };
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

  const { data, error } = existing
    ? await admin.from("subscriptions").update(payload).eq("id", existing.id).select("id").single<{ id: string }>()
    : await admin.from("subscriptions").insert(payload).select("id").single<{ id: string }>();

  if (error) {
    throw new Error(error.message);
  }

  return {
    mode: existing ? "updated" : "created",
    subscriptionId: data.id
  };
}

async function restoreManagedUser(user: AdminManagedUserRow) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("users")
    .update({
      plan: user.plan,
      plan_override: user.plan_override ?? false,
      plan_override_counts_as_revenue: user.plan_override_counts_as_revenue ?? false,
      billing_cycle: user.billing_cycle,
      subscription_price: user.subscription_price,
      subscription_status: user.subscription_status,
      next_billing_date: user.next_billing_date,
      last_payment_date: user.last_payment_date,
      is_trial: user.is_trial,
      trial_end_date: user.trial_end_date,
      trial_ends_at: user.trial_ends_at
    })
    .eq("id", user.id);

  if (error) {
    throw new Error(error.message);
  }
}

async function restoreSubscriptionMirror(input: {
  previousSubscription: ManagedSubscriptionRow | null;
  mutation: SubscriptionMirrorMutation | null;
}) {
  const admin = createSupabaseAdminClient();

  if (input.previousSubscription) {
    const { error } = await admin
      .from("subscriptions")
      .update({
        user_id: input.previousSubscription.user_id,
        email: input.previousSubscription.email,
        plan_name: input.previousSubscription.plan_name,
        plan_tier: input.previousSubscription.plan_tier,
        billing_interval: input.previousSubscription.billing_interval,
        original_price: input.previousSubscription.original_price,
        sale_price: input.previousSubscription.sale_price,
        paddle_customer_id: input.previousSubscription.paddle_customer_id,
        paddle_subscription_id: input.previousSubscription.paddle_subscription_id,
        status: input.previousSubscription.status,
        next_billing_date: input.previousSubscription.next_billing_date,
        last_payment_date: input.previousSubscription.last_payment_date
      })
      .eq("id", input.previousSubscription.id);

    if (error) {
      throw new Error(error.message);
    }

    return;
  }

  if (input.mutation?.mode === "created") {
    const { error } = await admin
      .from("subscriptions")
      .delete()
      .eq("id", input.mutation.subscriptionId);

    if (error) {
      throw new Error(error.message);
    }
  }
}

async function rollbackManualRevenueEntry(entryId: string | null) {
  if (!entryId) {
    return;
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("manual_revenue_entries").delete().eq("id", entryId);

  if (error) {
    throw new Error(error.message);
  }
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
    const previousSubscription = await loadLatestSubscription(user.id);
    let userUpdated = false;
    let subscriptionMutation: SubscriptionMirrorMutation | null = null;
    let revenueEntryId: string | null = null;

    try {
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

      userUpdated = true;

      subscriptionMutation = await syncSubscriptionMirror({
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
        const { data: revenueEntry, error: revenueError } = await admin
          .from("manual_revenue_entries")
          .insert({
            user_id: user.id,
            plan: parsed.data.plan,
            amount: getRevenueAmount(parsed.data.plan, resolved.salePrice),
            note: parsed.data.note?.trim() || null,
            created_at: nowIso
          })
          .select("id")
          .single<{ id: string }>();

        if (revenueError) {
          throw new Error(revenueError.message);
        }

        revenueEntryId = revenueEntry.id;
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
      if (userUpdated) {
        let rollbackError: Error | null = null;

        try {
          await rollbackManualRevenueEntry(revenueEntryId);
          await restoreSubscriptionMirror({
            previousSubscription,
            mutation: subscriptionMutation
          });
          await restoreManagedUser(user);
        } catch (restoreError) {
          rollbackError =
            restoreError instanceof Error
              ? restoreError
              : new Error("Automatic rollback failed.");
        }

        if (rollbackError) {
          const message = error instanceof Error ? error.message : "Unable to update the user plan.";
          return apiError(`${message} Automatic rollback failed: ${rollbackError.message}`, 500);
        }
      }

      throw error;
    }
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "Unable to update the user plan.",
      500
    );
  }
}
