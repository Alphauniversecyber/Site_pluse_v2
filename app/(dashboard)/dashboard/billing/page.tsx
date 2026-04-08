"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
    annualCopy: "Save $120/year — close 1 extra client and it pays for itself",
    badgeVariant: "default"
  },
  agency: {
    subtitle: "For agencies that want a premium client-delivery system inside their own service stack.",
    annualCopy: "Save $360/year — one retained client covers this many times over",
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
    <div className="space-y-10">
      <div className="space-y-8">
        <PageHeader
          eyebrow="Billing"
          title="Pricing built around agency ROI"
          description="Choose monthly or yearly billing, anchor pricing around the monthly equivalent, and start Growth or Pro free for 14 days without a credit card."
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
                  {user.trial_end_date ? <p>Trial ends: {formatDateTime(user.trial_end_date)}</p> : null}
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
                    <Link href="/pricing">View pricing page</Link>
                  </Button>
                ) : null}
              </div>
            </div>

            {hasLegacyStripeSubscription ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                This account still has a legacy Stripe subscription. Manage or cancel it in Stripe
                first, then start the PayPal version to avoid duplicate billing.
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="gap-4">
            <div className="space-y-2">
              <CardTitle>Choose your billing cycle</CardTitle>
              <p className="text-sm text-muted-foreground">
                Monthly stays flexible. Yearly uses the lower monthly equivalent so the real savings
                are obvious before checkout.
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
                    {yearlySelected && planKey !== "free" ? (
                      <>
                        <p className="text-sm text-muted-foreground">{getYearlyBillingCopy(planKey)}</p>
                        <p className="text-sm leading-6 text-emerald-600 dark:text-emerald-300">
                          {planMarketingCopy[planKey].annualCopy}
                        </p>
                      </>
                    ) : null}
                  </PriceFade>

                  <p className="mt-4 text-sm text-muted-foreground">
                    {isPaidPlan(planKey)
                      ? "Start free for 14 days — no credit card required"
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

      <SiteFooter className="rounded-[2rem] bg-background/60 shadow-[0_24px_70px_-54px_rgba(15,23,42,0.28)]" />
    </div>
  );
}
