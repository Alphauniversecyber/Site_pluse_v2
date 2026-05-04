"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";

import { BillingCycleToggle } from "@/components/pricing/billing-cycle-toggle";
import { PriceFade } from "@/components/pricing/price-fade";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BILLING_PLANS,
  getDiscountPercentage,
  formatUsdPrice,
  getDisplayedMonthlyEquivalent,
  getDisplayedOriginalMonthlyEquivalent,
  getMonthlySavings,
  getYearlyBillingCopy,
  getYearlySavingsLabel,
  hasPlanDiscount,
  type BillingPlanCatalog,
  isPaidPlan
} from "@/lib/billing";
import { cn } from "@/lib/utils";
import type { BillingCycle, PlanKey } from "@/types";

const pricingCards: Array<{
  key: PlanKey;
  badge?: string;
  subtitle: string;
  compactSubtitle: string;
  audience: string;
  roiLine: string;
  features: string[];
  cta: string;
  theme: "light" | "featured" | "dark";
}> = [
  {
    key: "free",
    badge: "For testing value",
    subtitle: "For freelancers testing whether fast audits can open better client conversations.",
    compactSubtitle: "For freelancers validating whether fast audits can open better client conversations.",
    audience: "Best for solo operators proving demand.",
    roiLine: "Win the first conversation with a no-risk free scan flow.",
    features: ["1 website", "Weekly scans", "30-day history", "Free scan preview funnel", "Core dashboard access"],
    cta: "Start with a free scan",
    theme: "light"
  },
  {
    key: "starter",
    subtitle: "For agencies managing multiple clients and turning website reviews into a repeatable sales and retention process.",
    compactSubtitle: "For agencies turning website reviews into a repeatable sales and retention system.",
    audience: "Best for growing agencies with active retainers.",
    roiLine: "Close 1 extra client and this plan pays for itself immediately.",
    features: ["5 websites", "Daily scans", "90-day history", "PDF reports", "Weekly email reports"],
    cta: "Start Growth",
    theme: "featured"
  },
  {
    key: "agency",
    subtitle: "For agencies that want SitePulse to feel like a premium client-delivery system inside their own service stack.",
    compactSubtitle: "For agencies that want a premium client-delivery system inside their own service stack.",
    audience: "Best for agencies scaling account coverage and brand authority.",
    roiLine: "One retained client usually covers this plan many times over.",
    features: ["30 websites", "Daily scans", "1-year history", "White-label reports", "Priority alerts and team access"],
    cta: "Start Pro",
    theme: "dark"
  }
] as const;

const foundingPriceLockCopy = "Cancel anytime · Founding price stays as long as you're subscribed";
const starterLockCopyCopy = "Upgrade before Jun 30 to lock in founding pricing";
const foundingSaleUrgencyCopy = "Sale closes Jun 30 — price locked in forever after";

const foundingPriceLockText = "Cancel anytime \u00B7 Founding price stays as long as you're subscribed";
const starterLockCopyText = "Upgrade before Jun 30 to lock in founding pricing";
const foundingSaleUrgencyText = "Sale closes Jun 30 \u2014 price locked in forever after";
const monthlyTrialText = "Start with a 14-day free trial \u2014 no credit card required";
const yearlyTrialText =
  "Start with a 14-day free trial \u2014 yearly plans also include 2 extra free months before annual billing starts";

void [foundingPriceLockCopy, starterLockCopyCopy, foundingSaleUrgencyCopy];

export function PricingGrid({
  plans = BILLING_PLANS,
  compact = false,
  showToggle = false
}: {
  plans?: BillingPlanCatalog;
  compact?: boolean;
  showToggle?: boolean;
}) {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");

  return (
    <div>
      {showToggle ? (
        <div className={cn(compact ? "mb-5" : "mb-7", "flex justify-center lg:justify-start")}>
          <BillingCycleToggle value={billingCycle} onChange={setBillingCycle} />
        </div>
      ) : null}

      <div className={cn("grid lg:grid-cols-3", compact ? "gap-4 xl:gap-5" : "gap-5 xl:gap-6")}>
        {pricingCards.map((plan) => {
          const planDefinition = plans[plan.key];
          const yearlySelected = billingCycle === "yearly";
          const paidPlan = isPaidPlan(plan.key);
          const displayedAmount = getDisplayedMonthlyEquivalent(plan.key, billingCycle, plans);
          const displayedOriginalAmount = getDisplayedOriginalMonthlyEquivalent(plan.key, billingCycle, plans);
          const monthlySavings = getMonthlySavings(plan.key, billingCycle, plans);
          const discountPercentage = getDiscountPercentage(plan.key, billingCycle, plans);
          const hasDiscount = hasPlanDiscount(plan.key, billingCycle, plans);

          return (
            <article
              key={planDefinition.displayName}
              className={cn(
                "group relative flex h-full flex-col overflow-hidden border transition duration-300 hover:-translate-y-1 hover:scale-[1.01] hover:shadow-[0_34px_84px_-40px_rgba(15,23,42,0.42)]",
                compact ? "rounded-[1.6rem] p-4 lg:p-4 xl:p-5" : "rounded-[1.8rem] p-5 lg:p-5 xl:p-6",
                plan.theme === "light" && "border-slate-200 bg-white text-slate-950",
                plan.theme === "featured" &&
                  "border-blue-300 bg-white text-slate-950 shadow-[0_0_0_1px_rgba(96,165,250,0.5),0_35px_90px_-40px_rgba(59,130,246,0.7)]",
                plan.theme === "dark" &&
                  "border-slate-200 bg-[linear-gradient(180deg,rgba(238,244,255,0.98),rgba(223,232,250,0.96))] text-slate-950 shadow-[0_18px_48px_-34px_rgba(59,130,246,0.24)] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(21,32,61,0.98),rgba(5,10,24,0.99))] dark:text-white dark:shadow-[0_32px_80px_-48px_rgba(3,7,18,0.95),0_0_0_1px_rgba(96,165,250,0.08)]"
              )}
            >
              {plan.theme === "featured" ? (
                <div className="pointer-events-none absolute inset-x-8 top-0 h-32 rounded-b-[2rem] bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.3),_transparent_70%)]" />
              ) : null}

              <div className="relative flex h-full flex-col">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Badge
                    className={cn(
                      compact
                        ? "w-fit px-3 py-1 text-xs tracking-normal normal-case"
                        : "w-fit px-3.5 py-1.5 text-[13px] tracking-normal normal-case",
                      paidPlan &&
                        "border-transparent bg-primary/10 text-primary",
                      !paidPlan && plan.theme === "light" && "bg-slate-100 text-slate-700",
                      !paidPlan && plan.theme === "featured" && "bg-gradient-to-r from-blue-500 to-blue-600 text-white",
                      !paidPlan &&
                        plan.theme === "dark" &&
                        "bg-slate-100 text-slate-700 dark:border-white/15 dark:bg-white/[0.08] dark:text-white"
                    )}
                  >
                    {paidPlan ? planDefinition.marketingBadge : plan.badge}
                  </Badge>

                  {paidPlan && hasDiscount ? (
                    <Badge
                      className={cn(
                        compact
                          ? "w-fit px-3 py-1 text-xs tracking-normal normal-case"
                          : "w-fit px-3.5 py-1.5 text-[13px] tracking-normal normal-case",
                        "border-transparent bg-primary text-primary-foreground"
                      )}
                    >
                      {discountPercentage}% OFF
                    </Badge>
                  ) : null}

                  {yearlySelected && paidPlan && getYearlySavingsLabel(plan.key, plans) ? (
                    <Badge
                      className={cn(
                        compact
                          ? "w-fit px-3 py-1 text-xs tracking-normal normal-case"
                          : "w-fit px-3.5 py-1.5 text-[13px] tracking-normal normal-case",
                        "border-transparent bg-primary text-primary-foreground"
                      )}
                    >
                      {getYearlySavingsLabel(plan.key, plans)}
                    </Badge>
                  ) : null}
                </div>

                <PriceFade trigger={`${plan.key}-${billingCycle}`} className={compact ? "mt-4" : "mt-5"}>
                  <div className="flex items-end gap-2">
                    {paidPlan ? (
                      <>
                        <span
                          className={cn(
                            "font-display font-semibold tracking-tight",
                            compact ? "text-[2.5rem] lg:text-[2.65rem]" : "text-[2.85rem] lg:text-[3rem]"
                          )}
                        >
                          {formatUsdPrice(displayedAmount)}
                        </span>
                        <span
                          className={cn(
                            compact ? "pb-0.5 text-base lg:text-[1.15rem]" : "pb-1 text-lg lg:text-[1.35rem]",
                            plan.theme === "dark" ? "text-slate-600 dark:text-slate-200" : "text-slate-500"
                          )}
                        >
                          /mo
                        </span>
                      </>
                    ) : (
                      <span
                        className={cn(
                          "font-display font-semibold tracking-tight",
                          compact ? "text-[2.35rem] lg:text-[2.5rem]" : "text-[2.65rem] lg:text-[2.8rem]"
                        )}
                      >
                        Free
                      </span>
                    )}
                  </div>

                  {paidPlan && hasDiscount ? (
                    <p
                      className={cn(
                        compact ? "mt-1 text-[13px] leading-6" : "mt-1.5 text-[14px] leading-6",
                        "line-through",
                        plan.theme === "dark" ? "text-slate-600 dark:text-slate-200" : "text-slate-500"
                      )}
                    >
                      {formatUsdPrice(displayedOriginalAmount)}/mo
                    </p>
                  ) : null}

                    {paidPlan && hasDiscount ? (
                    <>
                      <p className="mt-1 text-[12px] leading-5 text-primary">
                        You save {formatUsdPrice(monthlySavings)}/mo
                      </p>
                      {yearlySelected ? (
                        <p
                          className={cn(
                            compact ? "mt-1 text-[13px] leading-6" : "mt-1.5 text-[14px] leading-6",
                            plan.theme === "dark" ? "text-slate-600 dark:text-slate-200" : "text-slate-500"
                          )}
                        >
                          {getYearlyBillingCopy(plan.key, plans)}
                        </p>
                      ) : null}
                      <p
                        className={cn(
                          compact ? "mt-1 text-[12px] leading-5" : "mt-1 text-[13px] leading-6",
                          plan.theme === "dark" ? "text-slate-600 dark:text-slate-300" : "text-slate-500"
                        )}
                      >
                        {foundingSaleUrgencyText}
                      </p>
                    </>
                  ) : null}
                </PriceFade>

                {!yearlySelected && planDefinition.displayName !== "Starter" ? (
                  <p
                    className={cn(
                      compact ? "mt-1 text-[12px] leading-5" : "mt-1.5 text-[13px] leading-6",
                      plan.theme === "dark" ? "text-slate-600 dark:text-slate-300" : "text-slate-500"
                    )}
                  >
                    Start free for 14 days — no credit card required
                  </p>
                ) : null}

                {!paidPlan ? (
                  <p
                    className={cn(
                      compact ? "mt-1 text-[12px] leading-5" : "mt-1.5 text-[13px] leading-6",
                      plan.theme === "dark" ? "text-slate-600 dark:text-slate-300" : "text-slate-500"
                    )}
                  >
                    No credit card required
                  </p>
                ) : null}

                {yearlySelected && planDefinition.displayName !== "Starter" ? (
                  <p
                    className={cn(
                      compact ? "mt-1 text-[12px] leading-5" : "mt-1.5 text-[13px] leading-6",
                      plan.theme === "dark" ? "text-slate-600 dark:text-slate-300" : "text-slate-500"
                    )}
                  >
                    {yearlyTrialText}
                  </p>
                ) : null}

                <div className={compact ? "mt-3" : "mt-3.5"}>
                  <p className={cn("font-semibold leading-tight", compact ? "text-[1.6rem]" : "text-[1.9rem]")}>
                    {planDefinition.displayName}
                  </p>
                  <p
                    className={cn(
                      compact ? "mt-2 text-[14px] leading-6" : "mt-2.5 text-[15px] leading-7",
                      plan.theme === "dark" ? "text-slate-600 dark:text-slate-200" : "text-slate-600"
                    )}
                  >
                    {compact ? plan.compactSubtitle : plan.subtitle}
                  </p>
                </div>

                <div
                  className={cn(
                    compact ? "my-3 h-px" : "my-4 h-px",
                    plan.theme === "dark" ? "bg-slate-200 dark:bg-white/10" : "bg-slate-200"
                  )}
                />

                {compact ? (
                  <div
                    className={cn(
                      "rounded-[1.2rem] border px-3.5 py-3",
                      plan.theme === "dark"
                        ? "border-slate-200 bg-white/40 dark:border-white/10 dark:bg-white/[0.05]"
                        : "border-slate-200 bg-slate-50/90"
                    )}
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
                      Best for
                    </p>
                    <p
                      className={cn(
                        "mt-1.5 text-[14px] font-medium leading-5",
                        plan.theme === "dark" ? "text-slate-900 dark:text-slate-100" : "text-slate-800"
                      )}
                    >
                      {plan.audience}
                    </p>
                    <p
                      className={cn(
                        "mt-2 text-[13px] leading-5",
                        plan.theme === "dark" ? "text-slate-600 dark:text-slate-200" : "text-slate-600"
                      )}
                    >
                      {plan.roiLine}
                    </p>
                  </div>
                ) : (
                  <div
                    className={cn(
                      "rounded-[1.35rem] border px-4 py-3.5",
                      plan.theme === "dark"
                        ? "border-slate-200 bg-white/40 dark:border-white/10 dark:bg-white/[0.05]"
                        : "border-slate-200 bg-slate-50/90"
                    )}
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                      Positioning
                    </p>
                    <p
                      className={cn(
                        "mt-2 text-[15px] font-medium leading-6",
                        plan.theme === "dark" ? "text-slate-900 dark:text-slate-100" : "text-slate-800"
                      )}
                    >
                      {plan.audience}
                    </p>
                    <p
                      className={cn(
                        "mt-2 text-[15px] leading-6",
                        plan.theme === "dark" ? "text-slate-600 dark:text-slate-200" : "text-slate-600"
                      )}
                    >
                      {plan.roiLine}
                    </p>
                  </div>
                )}

                <ul
                  className={cn(
                    compact ? "mt-3 space-y-1.5 text-[14px]" : "mt-4 space-y-2 text-[15px]",
                    plan.theme === "dark" ? "text-slate-800 dark:text-white" : "text-slate-700"
                  )}
                >
                  {(compact ? plan.features.slice(0, 3) : plan.features).map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <Check
                        className={cn(
                          compact ? "mt-0.5 h-4 w-4 shrink-0" : "mt-0.5 h-[18px] w-[18px] shrink-0",
                          "text-primary"
                        )}
                      />
                      <span className={compact ? "leading-6" : "leading-7"}>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  asChild
                  className={cn(
                    compact ? "mt-4 h-11 w-full rounded-2xl text-[14px]" : "mt-5 h-12 w-full rounded-2xl text-[15px]",
                    plan.theme === "light" && "border-slate-300 bg-white text-slate-950 hover:bg-slate-100",
                    plan.theme === "featured" &&
                      "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-[0_20px_40px_-24px_rgba(59,130,246,0.9)] hover:from-blue-600 hover:to-blue-700",
                    plan.theme === "dark" && "bg-slate-950 text-white hover:bg-slate-900"
                  )}
                  variant={plan.theme === "featured" ? "default" : "outline"}
                >
                  <Link href={plan.key === "free" ? "/#free-scan" : "/signup"}>
                    {plan.cta}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <p
                  className={cn(
                    compact ? "mt-2 text-center text-[12px] leading-5" : "mt-2.5 text-center text-[13px] leading-6",
                    plan.theme === "dark" ? "text-slate-600 dark:text-slate-300" : "text-slate-500"
                  )}
                >
                  {paidPlan ? foundingPriceLockText : starterLockCopyText}
                </p>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

