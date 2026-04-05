"use client";

import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const plans: Array<{
  name: string;
  amount: string;
  badge: string;
  subtitle: string;
  audience: string;
  roiLine: string;
  features: string[];
  cta: string;
  theme: "light" | "featured" | "dark";
}> = [
  {
    name: "Starter",
    amount: "$0",
    badge: "For testing value",
    subtitle: "For freelancers testing whether fast audits can open better client conversations.",
    audience: "Best for solo operators proving demand.",
    roiLine: "Win the first conversation with a no-risk free scan flow.",
    features: ["1 website", "Weekly scans", "30-day history", "Free scan preview funnel", "Core dashboard access"],
    cta: "Start with a free scan",
    theme: "light"
  },
  {
    name: "Growth",
    amount: "$49",
    badge: "Most popular",
    subtitle: "For agencies managing multiple clients and turning website reviews into a repeatable sales and retention process.",
    audience: "Best for growing agencies with active retainers.",
    roiLine: "Close 1 extra client and this plan pays for itself immediately.",
    features: ["5 websites", "Daily scans", "90-day history", "PDF reports", "Weekly email reports"],
    cta: "Start Growth",
    theme: "featured"
  },
  {
    name: "Pro",
    amount: "$149",
    badge: "For serious scale",
    subtitle: "For agencies that want SitePulse to feel like a premium client-delivery system inside their own service stack.",
    audience: "Best for agencies scaling account coverage and brand authority.",
    roiLine: "One retained client usually covers this plan many times over.",
    features: ["30 websites", "Daily scans", "1-year history", "White-label reports", "Priority alerts and team access"],
    cta: "Start Pro",
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
                "w-fit px-4 py-2 text-sm tracking-normal normal-case",
                plan.theme === "light" && "bg-slate-100 text-slate-700",
                plan.theme === "featured" && "bg-gradient-to-r from-blue-500 to-blue-600 text-white",
                plan.theme === "dark" && "bg-white/10 text-white"
              )}
            >
              {plan.badge}
            </Badge>

            <div className="mt-6 flex items-end gap-2">
              <span className="font-display text-[3.2rem] font-semibold tracking-tight">{plan.amount}</span>
              <span className={cn("pb-1.5 text-xl", plan.theme === "dark" ? "text-slate-300" : "text-slate-500")}>
                /month
              </span>
            </div>

            <div className="mt-4">
              <p className="text-2xl font-semibold">{plan.name}</p>
              <p className={cn("mt-3 text-sm leading-6", plan.theme === "dark" ? "text-slate-300" : "text-slate-600")}>
                {plan.subtitle}
              </p>
            </div>

            <div className={cn("my-5 h-px", plan.theme === "dark" ? "bg-white/10" : "bg-slate-200")} />

            <div className={cn("rounded-[1.4rem] border px-4 py-4", plan.theme === "dark" ? "border-white/10 bg-white/[0.04]" : "border-slate-200 bg-slate-50/90")}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Positioning</p>
              <p className={cn("mt-2 text-sm font-medium", plan.theme === "dark" ? "text-slate-100" : "text-slate-800")}>
                {plan.audience}
              </p>
              <p className={cn("mt-2 text-sm leading-6", plan.theme === "dark" ? "text-slate-300" : "text-slate-600")}>
                {plan.roiLine}
              </p>
            </div>

            <ul className={cn("mt-5 space-y-2.5 text-[15px]", plan.theme === "dark" ? "text-slate-100" : "text-slate-700")}>
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-3">
                  <Check className={cn("mt-1 h-5 w-5 shrink-0", plan.theme === "featured" ? "text-blue-500" : "text-emerald-500")} />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

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
              <Link href={plan.amount === "$0" ? "/#free-scan" : "/signup"}>
                {plan.cta}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </article>
      ))}
    </div>
  );
}
