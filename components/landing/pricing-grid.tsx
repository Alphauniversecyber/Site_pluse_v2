"use client";

import Link from "next/link";
import { Check } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const plans: Array<{
  name: string;
  amount: string;
  badge: string;
  subtitle: string;
  features: string[];
  moreLabel?: string;
  cta: string;
  theme: "light" | "featured" | "dark";
}> = [
  {
    name: "Free",
    amount: "$0",
    badge: "Free",
    subtitle: "Perfect for testing SitePulse on your own site.",
    features: ["1 website", "Weekly scans", "30 day history", "Basic dashboard", "Email-free setup"],
    moreLabel: "No PDF reports or email reports",
    cta: "Get Started Free",
    theme: "light"
  },
  {
    name: "Starter",
    amount: "$49",
    badge: "Most Popular",
    subtitle: "The sweet spot for freelancers and small retainers.",
    features: [
      "5 websites",
      "Daily scans",
      "90 day history",
      "PDF report download",
      "Weekly email reports"
    ],
    moreLabel: "Includes email notifications and Core Web Vitals",
    cta: "Start Free Trial",
    theme: "featured"
  },
  {
    name: "Agency",
    amount: "$149",
    badge: "Agency",
    subtitle: "Built to resell monitoring and reporting at margin.",
    features: [
      "30 websites",
      "Daily scans",
      "1 year history",
      "White-label PDF reports",
      "Daily email reports"
    ],
    moreLabel: "Includes priority alerts, team access, CSV export, and reseller tools",
    cta: "Start Free Trial",
    theme: "dark"
  }
] as const;

export function PricingGrid() {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {plans.map((plan) => (
        <article
          key={plan.name}
          className={cn(
            "group relative flex h-full flex-col overflow-hidden rounded-[2rem] border p-6 transition duration-300 hover:-translate-y-1 hover:scale-[1.01] hover:shadow-[0_34px_84px_-40px_rgba(15,23,42,0.42)] lg:p-7",
            plan.theme === "light" && "border-slate-200 bg-white text-slate-950",
            plan.theme === "featured" &&
              "border-blue-300 bg-white text-slate-950 shadow-[0_0_0_1px_rgba(96,165,250,0.5),0_35px_90px_-40px_rgba(59,130,246,0.7)]",
            plan.theme === "dark" && "border-white/10 bg-[#141f3d] text-white"
          )}
        >
          {plan.theme === "featured" ? (
            <div className="pointer-events-none absolute inset-x-8 top-0 h-32 rounded-b-[2rem] bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.3),_transparent_70%)]" />
          ) : null}

          <div className="relative flex h-full flex-col">
            <Badge
              className={cn(
                "px-4 py-2 text-sm tracking-normal normal-case",
                plan.theme === "light" && "bg-slate-100 text-slate-700",
                plan.theme === "featured" && "bg-gradient-to-r from-blue-500 to-blue-600 text-white",
                plan.theme === "dark" && "bg-white/10 text-white"
              )}
            >
              {plan.badge}
            </Badge>

            <div className="mt-6 flex items-end gap-2">
              <span className="font-display text-[3.2rem] font-semibold tracking-tight">{plan.amount}</span>
              <span
                className={cn(
                  "pb-1.5 text-xl",
                  plan.theme === "dark" ? "text-slate-300" : "text-slate-500"
                )}
              >
                /month
              </span>
            </div>

            <p className={cn("mt-4 max-w-xs text-sm leading-6", plan.theme === "dark" ? "text-slate-300" : "text-slate-500")}>
              {plan.subtitle}
            </p>

            <div className={cn("my-5 h-px", plan.theme === "dark" ? "bg-white/10" : "bg-slate-200")} />

            <ul
              className={cn(
                "space-y-2.5 text-[15px]",
                plan.theme === "dark" ? "text-slate-100" : "text-slate-700"
              )}
            >
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-3">
                  <Check
                    className={cn(
                      "mt-1 h-5 w-5 shrink-0",
                      plan.theme === "featured" ? "text-blue-500" : "text-emerald-500"
                    )}
                  />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            {plan.moreLabel ? (
              <p
                className={cn(
                  "mt-5 text-sm font-medium",
                  plan.theme === "featured"
                    ? "text-blue-600"
                    : plan.theme === "dark"
                      ? "text-slate-300"
                      : "text-slate-500"
                )}
              >
                + more:
                {" "}
                <span className="font-normal">{plan.moreLabel}</span>
              </p>
            ) : null}

            <Button
              asChild
              className={cn(
                "mt-6 h-14 w-full rounded-2xl text-base",
                plan.theme === "light" && "border-slate-300 bg-white text-slate-950 hover:bg-slate-100",
                plan.theme === "featured" &&
                  "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-[0_20px_40px_-24px_rgba(59,130,246,0.9)] hover:from-blue-600 hover:to-blue-700",
                plan.theme === "dark" && "bg-slate-950 text-white hover:bg-slate-900"
              )}
              variant={plan.theme === "featured" ? "default" : "outline"}
            >
              <Link href="/signup">{plan.cta}</Link>
            </Button>
          </div>
        </article>
      ))}
    </div>
  );
}
