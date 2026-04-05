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
  compactSubtitle: string;
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
    compactSubtitle: "For freelancers validating whether fast audits can open better client conversations.",
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
    compactSubtitle: "For agencies turning website reviews into a repeatable sales and retention system.",
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
    compactSubtitle: "For agencies that want a premium client-delivery system inside their own service stack.",
    audience: "Best for agencies scaling account coverage and brand authority.",
    roiLine: "One retained client usually covers this plan many times over.",
    features: ["30 websites", "Daily scans", "1-year history", "White-label reports", "Priority alerts and team access"],
    cta: "Start Pro",
    theme: "dark"
  }
] as const;

export function PricingGrid({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn("grid lg:grid-cols-3", compact ? "gap-4 xl:gap-5" : "gap-5 xl:gap-6")}>
      {plans.map((plan) => (
        <article
          key={plan.name}
          className={cn(
            "group relative flex h-full flex-col overflow-hidden border transition duration-300 hover:-translate-y-1 hover:scale-[1.01] hover:shadow-[0_34px_84px_-40px_rgba(15,23,42,0.42)]",
            compact ? "rounded-[1.6rem] p-4 lg:p-4 xl:p-5" : "rounded-[1.8rem] p-5 lg:p-5 xl:p-6",
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
                compact ? "w-fit px-3 py-1 text-xs tracking-normal normal-case" : "w-fit px-3.5 py-1.5 text-[13px] tracking-normal normal-case",
                plan.theme === "light" && "bg-slate-100 text-slate-700",
                plan.theme === "featured" && "bg-gradient-to-r from-blue-500 to-blue-600 text-white",
                plan.theme === "dark" && "bg-white/10 text-white"
              )}
            >
              {plan.badge}
            </Badge>

            <div className={cn("flex items-end gap-2", compact ? "mt-4" : "mt-5")}>
              <span className={cn("font-display font-semibold tracking-tight", compact ? "text-[2.5rem] lg:text-[2.65rem]" : "text-[2.85rem] lg:text-[3rem]")}>
                {plan.amount}
              </span>
              <span className={cn(compact ? "pb-0.5 text-base lg:text-[1.15rem]" : "pb-1 text-lg lg:text-[1.35rem]", plan.theme === "dark" ? "text-slate-300" : "text-slate-500")}>
                /month
              </span>
            </div>

            <div className={compact ? "mt-3" : "mt-3.5"}>
              <p className={cn("font-semibold leading-tight", compact ? "text-[1.6rem]" : "text-[1.9rem]")}>{plan.name}</p>
              <p className={cn(compact ? "mt-2 text-[14px] leading-6" : "mt-2.5 text-[15px] leading-7", plan.theme === "dark" ? "text-slate-300" : "text-slate-600")}>
                {compact ? plan.compactSubtitle : plan.subtitle}
              </p>
            </div>

            <div className={cn(compact ? "my-3 h-px" : "my-4 h-px", plan.theme === "dark" ? "bg-white/10" : "bg-slate-200")} />

            {compact ? (
              <div
                className={cn(
                  "rounded-[1.2rem] border px-3.5 py-3",
                  plan.theme === "dark" ? "border-white/10 bg-white/[0.04]" : "border-slate-200 bg-slate-50/90"
                )}
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">Best for</p>
                <p
                  className={cn(
                    "mt-1.5 text-[14px] font-medium leading-5",
                    plan.theme === "dark" ? "text-slate-100" : "text-slate-800"
                  )}
                >
                  {plan.audience}
                </p>
                <p
                  className={cn(
                    "mt-2 text-[13px] leading-5",
                    plan.theme === "dark" ? "text-slate-300" : "text-slate-600"
                  )}
                >
                  {plan.roiLine}
                </p>
              </div>
            ) : (
              <div className={cn("rounded-[1.35rem] border px-4 py-3.5", plan.theme === "dark" ? "border-white/10 bg-white/[0.04]" : "border-slate-200 bg-slate-50/90")}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Positioning</p>
                <p className={cn("mt-2 text-[15px] font-medium leading-6", plan.theme === "dark" ? "text-slate-100" : "text-slate-800")}>
                  {plan.audience}
                </p>
                <p className={cn("mt-2 text-[15px] leading-6", plan.theme === "dark" ? "text-slate-300" : "text-slate-600")}>
                  {plan.roiLine}
                </p>
              </div>
            )}

            <ul className={cn(compact ? "mt-3 space-y-1.5 text-[14px]" : "mt-4 space-y-2 text-[15px]", plan.theme === "dark" ? "text-slate-100" : "text-slate-700")}>
              {(compact ? plan.features.slice(0, 3) : plan.features).map((feature) => (
                <li key={feature} className="flex items-start gap-3">
                  <Check className={cn(compact ? "mt-0.5 h-4 w-4 shrink-0" : "mt-0.5 h-[18px] w-[18px] shrink-0", plan.theme === "featured" ? "text-blue-500" : "text-emerald-500")} />
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
