"use client";

import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  BriefcaseBusiness,
  LayoutTemplate,
  SearchCheck
} from "lucide-react";

import { ClientDeliverablesSection } from "@/components/landing/client-deliverables-section";
import { DashboardMockup } from "@/components/landing/dashboard-mockup";
import { FreeScanFunnel } from "@/components/landing/free-scan-funnel";
import { PricingGrid } from "@/components/landing/pricing-grid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useUser } from "@/hooks/useUser";
import { formatUsdPrice, getPlanPricing, type BillingPlanCatalog } from "@/lib/billing";
import { marketingFaq } from "@/lib/marketing-copy";

const workflow = [
  {
    step: "01",
    title: "Scan the site before the call goes cold",
    description: "Drop in a client URL and get the first score, top issues, and a clear business story while the conversation is still active."
  },
  {
    step: "02",
    title: "Translate the issues into client language",
    description: "Turn performance, SEO, and accessibility problems into revenue risk, trust gaps, and concrete next steps."
  },
  {
    step: "03",
    title: "Send polished follow-up without extra work",
    description: "Deliver the white-label PDF and weekly email sequence that keeps your agency visible after the proposal."
  }
] as const;

const capabilityList = [
  {
    icon: SearchCheck,
    title: "Automated monitoring",
    description: "Stay proactive between meetings instead of discovering problems after a client asks."
  },
  {
    icon: LayoutTemplate,
    title: "White-label reports",
    description: "Give every deliverable your agency brand, not someone else's software chrome."
  },
  {
    icon: BriefcaseBusiness,
    title: "Business-impact framing",
    description: "Explain what the issue costs in traffic, conversions, trust, or missed opportunity."
  },
  {
    icon: BellRing,
    title: "Alerts that matter",
    description: "Know when scores dip, trust signals weaken, or an account needs attention."
  }
] as const;

const heroSignals = [
  { label: "First proof", value: "30 sec", note: "A fast scan preview they can understand immediately." },
  { label: "Delivery", value: "1 workflow", note: "Scan, explain, and follow up without stitching tools together." },
  { label: "Retention", value: "Weekly", note: "Ongoing reports that make your work stay visible." }
] as const;

const roiPoints = [
  "Use the free scan to open the conversation with proof instead of promises.",
  "Use the PDF to recap the problem and the email to keep your agency top of mind.",
  "Use weekly reporting to show continued value after the proposal becomes a retainer."
] as const;

export function AgencyGrowthHome({ plans }: { plans: BillingPlanCatalog }) {
  const { user } = useUser();
  const isAuthenticated = Boolean(user);
  const growthMonthlyPrice = getPlanPricing("starter", "monthly", plans).salePrice;
  const growthPriceLabel = formatUsdPrice(growthMonthlyPrice);

  return (
    <main className="bg-[linear-gradient(180deg,#f8fbff_0%,#f1f6ff_100%)] text-slate-950 dark:bg-none dark:bg-[#08111f] dark:text-slate-50">
      <section className="border-b border-slate-200/80 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.18),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(191,219,254,0.45),transparent_34%),linear-gradient(180deg,#fbfdff_0%,#eef5ff_100%)] dark:border-white/10 dark:bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.16),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(15,23,42,0.8),transparent_34%),linear-gradient(180deg,#0b1324_0%,#08111f_100%)]">
        <div className="mx-auto flex min-h-[680px] w-full max-w-[1480px] flex-col items-center gap-14 px-5 py-14 sm:px-6 md:px-8 md:py-18 lg:flex-row lg:px-10 xl:min-h-[760px] xl:px-14 xl:py-24">
          <div className="flex h-full max-w-3xl self-center flex-col justify-center">
            <Badge className="inline-flex w-fit border-blue-300/40 bg-blue-500/10 text-blue-700 dark:border-blue-400/20 dark:bg-blue-500/10 dark:text-blue-100">
              Premium audit reporting for digital agencies
            </Badge>
            <h1 className="mt-6 max-w-[13ch] font-display text-[clamp(2.2rem,4vw,3.2rem)] font-semibold leading-[0.98] text-slate-950 dark:text-white">
              Send branded audit proof that helps you close and retain better clients.
            </h1>
            <p className="mt-5 max-w-[40rem] text-[1.125rem] leading-[1.7] text-slate-600 dark:text-slate-300">
              SitePulse gives agencies one clean workflow for scanning a site, explaining the issues, and following up with deliverables clients actually read.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="rounded-2xl bg-blue-500 px-6 text-white hover:bg-blue-600">
                <Link href={isAuthenticated ? "/dashboard" : "/#free-scan"}>
                  {isAuthenticated ? "Go to Dashboard" : "Scan a website (free)"}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="rounded-2xl border-slate-300 bg-white/80 px-6 text-slate-900 hover:bg-slate-100 dark:border-white/12 dark:bg-white/[0.03] dark:text-slate-100 dark:hover:bg-white/[0.06]"
              >
                <Link href="/pricing">See pricing</Link>
              </Button>
            </div>
          </div>

          <div className="mx-auto flex w-full max-w-[620px] self-center flex-col justify-start">
            <FreeScanFunnel />
            <div className="mt-3 grid grid-cols-3 gap-3">
              {heroSignals.map((signal) => (
                <div
                  key={signal.label}
                  className="rounded-[1.2rem] border border-slate-200 bg-white/85 p-3 shadow-[0_20px_50px_-40px_rgba(15,23,42,0.18)] backdrop-blur dark:border-white/10 dark:bg-white/[0.03] dark:shadow-[0_20px_50px_-40px_rgba(2,6,23,0.9)]"
                >
                  <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-blue-700/80 dark:text-blue-200/80">
                    {signal.label}
                  </p>
                  <p className="mt-2 font-display text-[1.35rem] font-semibold leading-none text-slate-950 dark:text-white">
                    {signal.value}
                  </p>
                  <p className="mt-1.5 text-[11px] leading-5 text-slate-500 dark:text-slate-400">{signal.note}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200/80 bg-[#f3f8ff] dark:border-white/10 dark:bg-[#0a1426]">
        <div className="container py-16 md:py-20">
          <div className="grid gap-10 rounded-[2rem] border border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(240,247,255,0.96))] p-6 shadow-[0_34px_100px_-60px_rgba(15,23,42,0.18)] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.72),rgba(8,17,31,0.92))] dark:shadow-[0_34px_100px_-60px_rgba(2,6,23,0.95)] lg:grid-cols-[minmax(0,0.92fr)_minmax(320px,1.08fr)] lg:items-center lg:p-8 xl:p-10">
            <div className="max-w-2xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-700 dark:text-blue-200">Product proof</p>
              <h2 className="mt-4 max-w-xl font-display text-[2.2rem] font-semibold leading-tight text-slate-950 dark:text-white md:text-[2.7rem]">
                Show the exact problem, the likely cost, and the next step in one view.
              </h2>
              <p className="mt-5 max-w-xl text-base leading-7 text-slate-600 dark:text-slate-300 md:text-lg md:leading-8">
                Agencies lose momentum when the audit is technical, the explanation is vague, or the follow-up arrives too late. SitePulse keeps the story tight from first scan to delivered report.
              </p>
              <div className="mt-7 rounded-[1.5rem] border border-blue-300/30 bg-blue-50/90 p-5 dark:border-blue-400/16 dark:bg-blue-500/[0.08]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-700 dark:text-blue-200">Sales-ready example</p>
                <p className="mt-3 text-base leading-7 text-slate-700 dark:text-slate-100">
                  Your website is losing visitors due to slow load speed. Fixing three issues could improve performance by up to 30%.
                </p>
              </div>
            </div>

            <div className="mx-auto w-full max-w-[430px] justify-self-center lg:justify-self-end">
              <DashboardMockup />
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200/80 bg-[#f8fbff] dark:border-white/10 dark:bg-[#08111f]">
        <div className="container grid gap-14 py-16 md:py-20 xl:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] xl:items-center">
          <div className="flex h-full max-w-xl flex-col justify-center space-y-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-700 dark:text-blue-200">Workflow</p>
            <h2 className="font-display text-[2.2rem] font-semibold leading-tight text-slate-950 dark:text-white md:text-[2.8rem]">
              One clear system for proof, explanation, and follow-up.
            </h2>
            <p className="text-base leading-7 text-slate-600 dark:text-slate-300 md:text-lg md:leading-8">
              Each part of the page has one job because the product should too: reveal the problem fast, make it easy to explain, and keep your agency visible after the meeting.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              {capabilityList.map((item) => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.title}
                    className="rounded-[1.45rem] border border-slate-200 bg-white/85 px-4 py-4 shadow-[0_16px_40px_-34px_rgba(15,23,42,0.16)] dark:border-white/10 dark:bg-[#0d1728] dark:shadow-none"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-blue-300/30 bg-blue-500/10 text-blue-700 dark:border-blue-400/14 dark:bg-blue-500/[0.09] dark:text-blue-100">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-950 dark:text-white">{item.title}</p>
                        <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">{item.description}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="my-auto flex h-full flex-col justify-center space-y-4">
            {workflow.map((item) => (
              <div
                key={item.step}
                className="grid gap-4 rounded-[1.65rem] border border-slate-200 bg-white/85 p-5 shadow-[0_24px_70px_-50px_rgba(15,23,42,0.18)] dark:border-white/10 dark:bg-white/[0.03] dark:shadow-[0_24px_70px_-50px_rgba(2,6,23,0.9)] md:grid-cols-[84px_minmax(0,1fr)] md:items-start md:p-6"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-[1.2rem] border border-blue-300/30 bg-blue-500/10 font-display text-lg font-semibold text-blue-700 dark:border-blue-400/16 dark:bg-blue-500/[0.09] dark:text-blue-100">
                  {item.step}
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-slate-950 dark:text-white">{item.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-slate-500 dark:text-slate-400 md:text-base">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200/80 bg-[#f2f7ff] dark:border-white/10 dark:bg-[#091426]">
        <div className="container py-16 md:py-20">
          <div className="grid gap-8 rounded-[2rem] border border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(239,246,255,0.96))] p-6 shadow-[0_34px_100px_-60px_rgba(15,23,42,0.16)] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(12,22,38,0.96),rgba(8,17,31,0.96))] dark:shadow-[0_34px_100px_-60px_rgba(2,6,23,0.95)] xl:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)] xl:items-center xl:p-8">
            <div className="max-w-2xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-700 dark:text-blue-200">ROI</p>
              <h2 className="mt-4 font-display text-[2.2rem] font-semibold leading-tight text-slate-950 dark:text-white md:text-[2.8rem]">
                Close one extra client and the math becomes obvious.
              </h2>
              <p className="mt-5 max-w-xl text-base leading-7 text-slate-600 dark:text-slate-300 md:text-lg md:leading-8">
                One solid agency client can easily be worth $500 or more per month. SitePulse starts at {growthPriceLabel} per month, so the tool only needs to help you close or retain one account to justify itself.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Badge className="border-slate-200 bg-white/80 text-slate-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-100">Close 1 client = $500+</Badge>
                <Badge className="border-slate-200 bg-white/80 text-slate-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-100">
                  SitePulse = {growthPriceLabel}/month
                </Badge>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="grid gap-4 rounded-[1.75rem] border border-slate-200 bg-white/85 p-5 shadow-[0_20px_56px_-42px_rgba(15,23,42,0.16)] dark:border-white/10 dark:bg-white/[0.03] dark:shadow-none md:grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)] md:items-center md:p-6">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-700 dark:text-blue-200">Typical account value</p>
                  <p className="mt-3 font-display text-[3rem] font-semibold leading-none text-slate-950 dark:text-white md:text-[3.5rem]">$500+</p>
                  <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">Monthly revenue from one client win or one account you keep from slipping.</p>
                </div>
                <div className="hidden h-full bg-slate-200 md:block dark:bg-white/10" />
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-700 dark:text-blue-200">Growth plan</p>
                  <p className="mt-3 font-display text-[3rem] font-semibold leading-none text-slate-950 dark:text-white md:text-[3.5rem]">{growthPriceLabel}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">Per month for the workflow that creates the proof, the report, and the follow-up.</p>
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-blue-300/30 bg-blue-50/85 p-5 dark:border-blue-400/14 dark:bg-blue-500/[0.08] md:p-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-700 dark:text-blue-100">Why agencies keep it</p>
                <div className="mt-4 space-y-3">
                  {roiPoints.map((point) => (
                    <p key={point} className="text-sm leading-7 text-slate-700 dark:text-slate-200">
                      {point}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <ClientDeliverablesSection />

      <section id="pricing" className="border-b border-slate-200/80 bg-[#f8fbff] dark:border-white/10 dark:bg-[#08111f]">
        <div className="container py-16 md:py-20">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-700 dark:text-blue-200">Pricing</p>
            <h2 className="mt-4 font-display text-[2.2rem] font-semibold leading-tight text-slate-950 dark:text-white md:text-[2.8rem]">
              Plans framed around agency value, not software complexity.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300 md:text-lg md:leading-8">
              Start with the free scan, standardize delivery on Growth, and scale into a premium client-reporting system as your workload grows.
            </p>
          </div>
          <div className="mt-8">
            <PricingGrid plans={plans} compact />
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200/80 bg-[#f2f7ff] dark:border-white/10 dark:bg-[#091426]">
        <div className="container py-16 md:py-20">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-700 dark:text-blue-200">FAQ</p>
            <h2 className="mt-4 font-display text-[2.2rem] font-semibold leading-tight text-slate-950 dark:text-white md:text-[2.8rem]">
              Questions agencies ask before making this part of their offer.
            </h2>
          </div>
          <div className="mt-10 space-y-4">
            {marketingFaq.map((item) => (
              <details
                key={item.question}
                className="rounded-[1.6rem] border border-slate-200 bg-white/88 p-6 shadow-[0_24px_70px_-50px_rgba(15,23,42,0.18)] dark:border-white/10 dark:bg-white/[0.03] dark:shadow-[0_24px_70px_-50px_rgba(2,6,23,0.85)]"
              >
                <summary className="cursor-pointer list-none font-display text-xl font-semibold text-slate-950 dark:text-white">
                  {item.question}
                </summary>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-500 dark:text-slate-400">{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[linear-gradient(180deg,#f2f7ff_0%,#eef5ff_100%)] dark:bg-[linear-gradient(180deg,#091426_0%,#07101d_100%)]">
        <div className="container py-16 md:py-20">
          <div className="rounded-[2rem] border border-slate-200 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.14),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(239,246,255,0.96))] p-8 text-center shadow-[0_36px_110px_-70px_rgba(15,23,42,0.16)] dark:border-white/10 dark:bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.16),transparent_34%),linear-gradient(180deg,rgba(12,22,38,0.96),rgba(8,17,31,0.98))] dark:shadow-[0_36px_110px_-70px_rgba(2,6,23,0.95)] md:p-12">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-700 dark:text-blue-200">Final CTA</p>
            <h2 className="mx-auto mt-4 max-w-3xl font-display text-[2.3rem] font-semibold leading-tight text-slate-950 dark:text-white md:text-[3rem]">
              Start the client conversation with proof, then keep it moving with delivery that looks expensive.
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300 md:text-lg md:leading-8">
              Run the free scan, unlock the full report after signup, and turn technical findings into a cleaner, more premium agency workflow.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" className="rounded-2xl bg-blue-500 px-6 text-white hover:bg-blue-600">
                <Link href={isAuthenticated ? "/dashboard" : "/#free-scan"}>
                  {isAuthenticated ? "Go to Dashboard" : "Scan a website (free)"}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="rounded-2xl border-slate-300 bg-white/80 px-6 text-slate-900 hover:bg-slate-100 dark:border-white/12 dark:bg-white/[0.03] dark:text-slate-100 dark:hover:bg-white/[0.06]"
              >
                <Link href="/pricing">See plan ROI</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
