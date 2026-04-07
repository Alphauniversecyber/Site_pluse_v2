"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUser } from "@/hooks/useUser";
import { fetchJson } from "@/lib/api-client";
import { BILLING_PLANS, formatUsdPrice, getPlanAmount, isPaidPlan, type PaidPlanKey } from "@/lib/billing";
import { formatDateTime, getPlanDisplayName } from "@/lib/utils";
import type { BillingCycle, PlanKey } from "@/types";

const paidPlanFeatures: Record<PaidPlanKey, string[]> = {
  starter: [
    "5 websites",
    "Daily scans",
    "90-day history",
    "PDF reports",
    "Weekly email reports",
    "14-day free trial"
  ],
  agency: [
    "30 websites",
    "Daily scans",
    "1-year history",
    "White-label reports",
    "Priority alerts and team access",
    "14-day free trial"
  ]
};

function getPlanRank(plan: PlanKey) {
  if (plan === "agency") {
    return 2;
  }

  if (plan === "starter") {
    return 1;
  }

  return 0;
}

export default function BillingPage() {
  const { user, loading, refetch } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [submittingPlan, setSubmittingPlan] = useState<string | null>(null);
  const [canceling, setCanceling] = useState(false);
  const handledPaypalReturnRef = useRef(false);

  const hasLegacyStripeSubscription = Boolean(
    user?.plan !== "free" &&
      user?.stripe_customer_id &&
      user?.stripe_subscription_id &&
      !user?.paypal_subscription_id
  );
  const hasCancelablePayPalSubscription = Boolean(
    user?.paypal_subscription_id &&
      user?.subscription_status &&
      !["cancelled", "inactive"].includes(user.subscription_status)
  );

  useEffect(() => {
    if (user?.billing_cycle) {
      setBillingCycle(user.billing_cycle);
    }
  }, [user?.billing_cycle]);

  useEffect(() => {
    const state = searchParams.get("paypal");
    const subscriptionId =
      searchParams.get("subscription_id") ??
      searchParams.get("ba_token") ??
      searchParams.get("token");

    if (!state || handledPaypalReturnRef.current) {
      return;
    }

    handledPaypalReturnRef.current = true;

    if (state === "canceled") {
      toast.message("PayPal checkout was canceled.");
      router.replace("/dashboard/billing");
      return;
    }

    if (state !== "success" || !subscriptionId) {
      router.replace("/dashboard/billing");
      return;
    }

    void (async () => {
      try {
        await fetchJson("/api/paypal/confirm", {
          method: "POST",
          body: JSON.stringify({ subscriptionId })
        });
        await refetch();
        toast.success("Your PayPal subscription is active.");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Unable to confirm the PayPal subscription."
        );
      } finally {
        router.replace("/dashboard/billing");
      }
    })();
  }, [refetch, router, searchParams]);

  async function startPayPal(plan: PaidPlanKey, cycle: BillingCycle) {
    if (hasLegacyStripeSubscription) {
      toast.error("Cancel the legacy Stripe subscription first before moving this account to PayPal.");
      return;
    }

    try {
      setSubmittingPlan(`${plan}:${cycle}`);
      const data = await fetchJson<{
        approvalUrl: string;
      }>("/api/paypal/subscribe", {
        method: "POST",
        body: JSON.stringify({ plan, billingCycle: cycle })
      });
      window.location.href = data.approvalUrl;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to start the PayPal checkout flow."
      );
    } finally {
      setSubmittingPlan(null);
    }
  }

  async function cancelPayPal() {
    try {
      setCanceling(true);
      await fetchJson("/api/paypal/cancel", {
        method: "POST",
        body: JSON.stringify({
          reason: "Customer requested cancellation from the billing dashboard."
        })
      });
      await refetch();
      toast.success("Your PayPal subscription has been cancelled.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to cancel the PayPal subscription."
      );
    } finally {
      setCanceling(false);
    }
  }

  async function openBillingPortal() {
    try {
      const data = await fetchJson<{ url: string }>("/api/stripe/portal", {
        method: "POST"
      });
      window.location.href = data.url;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to open billing portal.");
    }
  }

  const currentPlanLabel = useMemo(() => {
    if (!user) {
      return "";
    }

    if (user.plan === "free") {
      return "Starter";
    }

    return getPlanDisplayName(user.plan);
  }, [user]);

  if (loading || !user) {
    return <p className="text-muted-foreground">Loading billing...</p>;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Billing"
        title="PayPal subscriptions built around agency ROI"
        description="Start paid plans with PayPal, choose monthly or yearly billing, take a 14-day free trial on Growth or Pro, and switch plans without leaving the dashboard."
      />

      <Card>
        <CardHeader>
          <CardTitle>Current subscription</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <Badge
                  variant={
                    user.plan === "agency"
                      ? "success"
                      : user.plan === "starter"
                        ? "default"
                        : "outline"
                  }
                >
                  {currentPlanLabel} plan
                </Badge>
                <Badge variant="outline">
                  {user.subscription_status
                    ? user.subscription_status.replace(/_/g, " ")
                    : "inactive"}
                </Badge>
                {user.billing_cycle ? (
                  <Badge variant="outline">{user.billing_cycle}</Badge>
                ) : null}
              </div>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  {user.plan === "free"
                    ? "You are currently on the free Starter plan."
                    : `You are on the ${currentPlanLabel} plan.`}
                </p>
                {user.subscription_price !== null ? (
                  <p>
                    Price: {formatUsdPrice(user.subscription_price)} /{" "}
                    {user.billing_cycle === "yearly" ? "year" : "month"}
                  </p>
                ) : null}
                {user.trial_end_date ? (
                  <p>Trial ends: {formatDateTime(user.trial_end_date)}</p>
                ) : null}
                {user.next_billing_date ? (
                  <p>Next billing date: {formatDateTime(user.next_billing_date)}</p>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              {hasCancelablePayPalSubscription ? (
                <Button variant="outline" onClick={cancelPayPal} disabled={canceling}>
                  {canceling ? "Cancelling..." : "Cancel PayPal subscription"}
                </Button>
              ) : null}
              {hasLegacyStripeSubscription ? (
                <Button onClick={openBillingPortal}>Open Stripe billing portal</Button>
              ) : user.plan === "free" ? (
                <Button asChild>
                  <Link href="/pricing">View plan ROI</Link>
                </Button>
              ) : null}
            </div>
          </div>

          {hasLegacyStripeSubscription ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              This account still has a legacy Stripe subscription. Manage or cancel it in Stripe first,
              then start the PayPal version to avoid duplicate billing.
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Choose your billing cycle</CardTitle>
            <p className="mt-2 text-sm text-muted-foreground">
              Growth and Pro include a 14-day free trial. Yearly pricing reflects the requested
              20% discount.
            </p>
          </div>
          <div className="inline-flex rounded-full border border-border bg-muted p-1">
            {(["monthly", "yearly"] as BillingCycle[]).map((cycle) => (
              <button
                key={cycle}
                type="button"
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  billingCycle === cycle
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground"
                }`}
                onClick={() => setBillingCycle(cycle)}
              >
                {cycle === "monthly" ? "Monthly" : "Yearly"}
              </button>
            ))}
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-6 xl:grid-cols-3">
        {(Object.keys(BILLING_PLANS) as PlanKey[]).map((planKey) => {
          const plan = BILLING_PLANS[planKey];
          const isCurrentPlan =
            user.plan === planKey &&
            (planKey === "free" ||
              (user.billing_cycle === billingCycle &&
                (user.subscription_status === "active" || user.subscription_status === "trialing")));
          const planRank = getPlanRank(planKey);
          const currentRank = getPlanRank(user.plan);
          const actionLabel =
            planKey === "free"
              ? user.plan === "free"
                ? "Current free plan"
                : "Downgrade to Starter"
              : isCurrentPlan
                ? "Current plan"
                : planRank > currentRank
                  ? `Upgrade to ${plan.displayName}`
                  : user.plan === planKey
                    ? `Switch to ${billingCycle}`
                    : `Choose ${plan.displayName}`;

          return (
            <Card key={planKey} className={planKey === "starter" ? "border-primary/30 shadow-sm" : undefined}>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle>{plan.displayName}</CardTitle>
                  {plan.yearlySavingsLabel ? <Badge>{plan.yearlySavingsLabel}</Badge> : null}
                </div>
                <p className="text-sm text-muted-foreground">{plan.audience}</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  <p className="font-display text-4xl font-semibold">
                    {formatUsdPrice(plan.monthlyPrice)}
                    <span className="ml-2 text-base font-normal text-muted-foreground">/ month</span>
                  </p>
                  <p className="text-base font-medium text-muted-foreground">
                    {formatUsdPrice(plan.yearlyPrice)} / year
                    {plan.yearlySavingsLabel ? ` (${plan.yearlySavingsLabel})` : ""}
                  </p>
                </div>

                {isPaidPlan(planKey) ? (
                  <p className="mt-4 text-sm text-muted-foreground">
                    Includes a {plan.trialDays}-day free trial on the {billingCycle} billing cycle.
                  </p>
                ) : (
                  <p className="mt-4 text-sm text-muted-foreground">
                    Start free with one website and weekly scans.
                  </p>
                )}

                <div className="mt-6 space-y-3">
                  {(planKey === "free"
                    ? ["1 website", "Weekly scans", "30-day history", "Free scan preview funnel"]
                    : paidPlanFeatures[planKey]
                  ).map((feature) => (
                    <div key={feature} className="flex items-center gap-3 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      {feature}
                    </div>
                  ))}
                </div>

                {planKey === "free" ? (
                  <Button
                    className="mt-8 w-full"
                    variant={user.plan === "free" ? "outline" : "default"}
                    disabled={user.plan === "free" || !hasCancelablePayPalSubscription}
                    onClick={cancelPayPal}
                  >
                    {actionLabel}
                  </Button>
                ) : (
                  <Button
                    className="mt-8 w-full"
                    variant={isCurrentPlan ? "outline" : "default"}
                    disabled={isCurrentPlan || submittingPlan === `${planKey}:${billingCycle}`}
                    onClick={() => startPayPal(planKey, billingCycle)}
                  >
                    {submittingPlan === `${planKey}:${billingCycle}`
                      ? "Redirecting to PayPal..."
                      : actionLabel}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
