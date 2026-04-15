"use client";

import Link from "next/link";
import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/dashboard/page-header";
import { SiteFooter } from "@/components/landing/site-footer";
import { BillingCycleToggle } from "@/components/pricing/billing-cycle-toggle";
import { PriceFade } from "@/components/pricing/price-fade";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUser } from "@/hooks/useUser";
import { fetchJson } from "@/lib/api-client";
import {
  BILLING_PLANS,
  formatUsdPrice,
  getDisplayedMonthlyEquivalent,
  getPlanOriginalAmount,
  getPlanPricing,
  getYearlyBillingCopy,
  isPaidPlan,
  type PaidPlanKey
} from "@/lib/billing";
import { formatDateTime, getPlanDisplayName } from "@/lib/utils";
import type { BillingCycle, PlanKey } from "@/types";

const paidPlanFeatures: Record<PaidPlanKey, string[]> = {
  starter: [
    "5 websites",
    "Daily scans",
    "90-day history",
    "PDF reports",
    "Weekly email reports",
    "Sale pricing through Paddle"
  ],
  agency: [
    "30 websites",
    "Daily scans",
    "1-year history",
    "White-label reports",
    "Priority alerts and team access",
    "Sale pricing through Paddle"
  ]
};

const planMarketingCopy: Record<
  PlanKey,
  {
    subtitle: string;
    annualCopy?: string;
    badgeVariant?: "default" | "outline" | "success";
  }
> = {
  free: {
    subtitle: "For freelancers validating whether fast audits can open better client conversations.",
    badgeVariant: "outline"
  },
  starter: {
    subtitle: "For agencies turning website reviews into a repeatable sales and retention system.",
    annualCopy: "Yearly sale pricing is billed annually at $180.",
    badgeVariant: "default"
  },
  agency: {
    subtitle: "For agencies that want a premium client-delivery system inside their own service stack.",
    annualCopy: "Yearly sale pricing is billed annually at $588.",
    badgeVariant: "outline"
  }
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
  const searchParams = useSearchParams();
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [submittingPlan, setSubmittingPlan] = useState<string | null>(null);
  const [openingPortal, setOpeningPortal] = useState(false);
  const paddleInitializedRef = useRef(false);
  const handledToastStateRef = useRef<string | null>(null);
  const confirmingTransactionsRef = useRef<Set<string>>(new Set());
  const eventHandlerRef = useRef<(event: PaddleCheckoutEvent) => void>(() => {});
  const refetchRef = useRef(refetch);

  const hasPaidPaddleSubscription = Boolean(
    user?.paddle_subscription_id &&
      user?.subscription_status &&
      ["active", "trialing", "past_due", "paused"].includes(user.subscription_status)
  );

  refetchRef.current = refetch;

  useEffect(() => {
    const state = searchParams.get("paddle");

    if (!state || handledToastStateRef.current === state) {
      return;
    }

    handledToastStateRef.current = state;

    if (state === "canceled") {
      toast.message("Paddle checkout was canceled.");
      return;
    }

    if (state === "success") {
      toast.success("Paddle checkout finished. We are syncing your subscription.");
    }
  }, [searchParams]);

  eventHandlerRef.current = (event) => {
    if (event.name === "checkout.closed") {
      setSubmittingPlan(null);
      return;
    }

    if (event.name !== "checkout.completed") {
      return;
    }

    const transactionId = typeof event.data.transaction_id === "string" ? event.data.transaction_id : null;
    setSubmittingPlan(null);

    if (!transactionId || confirmingTransactionsRef.current.has(transactionId)) {
      return;
    }

    confirmingTransactionsRef.current.add(transactionId);

    void (async () => {
      try {
        await fetchJson("/api/paddle/confirm", {
          method: "POST",
          body: JSON.stringify({ transactionId })
        });
        await refetchRef.current();
        toast.success("Your Paddle subscription is active.");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Unable to confirm the Paddle checkout."
        );
      } finally {
        confirmingTransactionsRef.current.delete(transactionId);
      }
    })();
  };

  function initializePaddle(clientToken: string, environment: "sandbox" | "production") {
    if (!window.Paddle) {
      throw new Error("Paddle.js is still loading. Please try again in a moment.");
    }

    if (environment === "sandbox") {
      window.Paddle.Environment?.set("sandbox");
    }

    if (paddleInitializedRef.current) {
      return;
    }

    window.Paddle.Initialize({
      token: clientToken,
      eventCallback: (event) => eventHandlerRef.current(event)
    });

    paddleInitializedRef.current = true;
  }

  async function startPaddle(plan: PaidPlanKey, cycle: BillingCycle) {
    if (hasPaidPaddleSubscription) {
      await openBillingPortal();
      return;
    }

    try {
      setSubmittingPlan(`${plan}:${cycle}`);
      const data = await fetchJson<{
        clientToken: string;
        environment: "sandbox" | "production";
        priceId: string;
        successUrl: string;
        customerEmail: string;
        customData: Record<string, unknown>;
      }>("/api/paddle/config", {
        method: "POST",
        body: JSON.stringify({ plan, billingCycle: cycle })
      });

      initializePaddle(data.clientToken, data.environment);

      window.Paddle?.Checkout.open({
        items: [
          {
            priceId: data.priceId,
            quantity: 1
          }
        ],
        customer: {
          email: data.customerEmail
        },
        customData: data.customData,
        settings: {
          displayMode: "overlay",
          theme: "light",
          locale: "en",
          variant: "multi-page"
        }
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to start the Paddle checkout flow."
      );
      setSubmittingPlan(null);
    }
  }

  async function openBillingPortal() {
    try {
      setOpeningPortal(true);
      const data = await fetchJson<{
        url: string;
      }>("/api/paddle/portal", {
        method: "POST"
      });

      window.location.href = data.url;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to open the Paddle portal.");
    } finally {
      setOpeningPortal(false);
    }
  }

  if (loading || !user) {
    return <p className="text-muted-foreground">Loading billing...</p>;
  }

  const currentPlanLabel = user.plan === "free" ? "Starter" : getPlanDisplayName(user.plan);
  const currentPaidSelection =
    user.plan !== "free" && user.billing_cycle ? getPlanPricing(user.plan, user.billing_cycle) : null;

  return (
    <div className="space-y-10">
      <Script src="https://cdn.paddle.com/paddle/v2/paddle.js" strategy="afterInteractive" />

      <div className="space-y-8">
        <PageHeader
          eyebrow="Billing"
          title="Paddle checkout with live sale pricing"
          description="Choose monthly or yearly billing, see the original price next to the current sale price, and manage any active subscription through Paddle."
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
                  {user.billing_cycle ? <Badge variant="outline">{user.billing_cycle}</Badge> : null}
                </div>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>
                    {user.plan === "free" && !user.is_trial
                      ? "You are currently on the free Starter plan."
                      : user.is_trial && !user.paddle_subscription_id
                        ? `You currently have trial access to the ${currentPlanLabel} plan.`
                        : `You are on the ${currentPlanLabel} plan.`}
                  </p>
                  {currentPaidSelection ? (
                    <p>
                      Sale price: {formatUsdPrice(currentPaidSelection.salePrice)} /{" "}
                      {user.billing_cycle === "yearly" ? "year" : "month"}
                    </p>
                  ) : null}
                  {currentPaidSelection ? (
                    <p className="line-through">
                      Original price: {formatUsdPrice(currentPaidSelection.originalPrice)} /{" "}
                      {user.billing_cycle === "yearly" ? "year" : "month"}
                    </p>
                  ) : null}
                  {user.trial_end_date ? <p>Trial ends: {formatDateTime(user.trial_end_date)}</p> : null}
                  {user.last_payment_date ? <p>Last payment: {formatDateTime(user.last_payment_date)}</p> : null}
                  {user.next_billing_date ? (
                    <p>Next billing date: {formatDateTime(user.next_billing_date)}</p>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                {hasPaidPaddleSubscription ? (
                  <Button onClick={openBillingPortal} disabled={openingPortal}>
                    {openingPortal ? "Opening Paddle..." : "Manage in Paddle"}
                  </Button>
                ) : user.plan === "free" ? (
                  <Button asChild>
                    <Link href="/pricing">View pricing page</Link>
                  </Button>
                ) : null}
              </div>
            </div>

            {hasPaidPaddleSubscription ? (
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
                Plan changes, payment method updates, and cancellations are handled through the Paddle customer portal to avoid duplicate subscriptions.
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="gap-4">
            <div className="space-y-2">
              <CardTitle>Choose your billing cycle</CardTitle>
              <p className="text-sm text-muted-foreground">
                Monthly stays flexible. Yearly shows the sale price divided by 12 so the monthly equivalent is obvious before checkout.
              </p>
            </div>
            <BillingCycleToggle value={billingCycle} onChange={setBillingCycle} />
          </CardHeader>
        </Card>

        <div className="grid gap-6 xl:grid-cols-3">
          {(Object.keys(BILLING_PLANS) as PlanKey[]).map((planKey) => {
            const plan = BILLING_PLANS[planKey];
            const yearlySelected = billingCycle === "yearly";
            const displayedAmount = getDisplayedMonthlyEquivalent(planKey, billingCycle);
            const originalAmount =
              yearlySelected && planKey !== "free"
                ? Math.round(getPlanOriginalAmount(planKey, billingCycle) / 12)
                : getPlanOriginalAmount(planKey, billingCycle);
            const isCurrentPlan =
              planKey === "free"
                ? user.plan === "free" && !hasPaidPaddleSubscription
                : hasPaidPaddleSubscription &&
                  user.plan === planKey &&
                  user.billing_cycle === billingCycle &&
                  Boolean(
                    user.subscription_status &&
                      ["active", "trialing", "past_due", "paused"].includes(user.subscription_status)
                  );
            const planRank = getPlanRank(planKey);
            const currentRank = getPlanRank(user.plan);
            const actionLabel =
              planKey === "free"
                ? user.plan === "free"
                  ? "Current free plan"
                  : "Manage in Paddle"
                : isCurrentPlan
                  ? "Current plan"
                  : hasPaidPaddleSubscription
                    ? "Manage in Paddle"
                    : planRank > currentRank
                      ? `Upgrade to ${plan.displayName}`
                      : user.plan === planKey
                        ? `Switch to ${billingCycle}`
                        : `Choose ${plan.displayName}`;

            return (
              <Card
                key={planKey}
                className={planKey === "starter" ? "border-primary/30 shadow-sm" : undefined}
              >
                <CardHeader className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Badge variant={planMarketingCopy[planKey].badgeVariant}>
                      {plan.marketingBadge ?? plan.displayName}
                    </Badge>
                    {isCurrentPlan ? <Badge variant="success">Current</Badge> : null}
                  </div>
                  <div>
                    <CardTitle>{plan.displayName}</CardTitle>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {planMarketingCopy[planKey].subtitle}
                    </p>
                  </div>
                </CardHeader>
                <CardContent>
                  <PriceFade trigger={`${planKey}-${billingCycle}`} className="space-y-1">
                    <p className="font-display text-4xl font-semibold">
                      {formatUsdPrice(displayedAmount)}
                      <span className="ml-2 text-base font-normal text-muted-foreground">/ month</span>
                    </p>
                    {planKey !== "free" ? (
                      <p className="text-sm text-muted-foreground line-through">
                        Regularly {formatUsdPrice(originalAmount)} / month
                      </p>
                    ) : null}
                    {yearlySelected && planKey !== "free" ? (
                      <>
                        <p className="text-sm text-muted-foreground">{getYearlyBillingCopy(planKey)}</p>
                        <p className="text-sm text-muted-foreground line-through">
                          Regularly {formatUsdPrice(getPlanOriginalAmount(planKey, billingCycle))}/year
                        </p>
                        <p className="text-sm leading-6 text-emerald-600 dark:text-emerald-300">
                          {planMarketingCopy[planKey].annualCopy}
                        </p>
                      </>
                    ) : null}
                  </PriceFade>

                  <p className="mt-4 text-sm text-muted-foreground">
                    {isPaidPlan(planKey)
                      ? hasPaidPaddleSubscription
                        ? "Use the Paddle portal to change an active subscription without creating duplicates."
                        : "All paid subscriptions are charged at the sale price shown here."
                      : "Stay on Starter for $0/month or $0/year while you validate demand."}
                  </p>

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
                      disabled={user.plan === "free" && !hasPaidPaddleSubscription}
                      onClick={() => {
                        void openBillingPortal();
                      }}
                    >
                      {actionLabel}
                    </Button>
                  ) : (
                    <Button
                      className="mt-8 w-full"
                      variant={isCurrentPlan ? "outline" : "default"}
                      disabled={isCurrentPlan || openingPortal || submittingPlan === `${planKey}:${billingCycle}`}
                      onClick={() => {
                        if (hasPaidPaddleSubscription) {
                          void openBillingPortal();
                          return;
                        }

                        void startPaddle(planKey, billingCycle);
                      }}
                    >
                      {submittingPlan === `${planKey}:${billingCycle}` ? "Opening Paddle..." : actionLabel}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <SiteFooter className="rounded-[2rem] bg-background/60 shadow-[0_24px_70px_-54px_rgba(15,23,42,0.28)]" />
    </div>
  );
}
