"use client";

import Link from "next/link";
import { ArrowRight, BellRing, BriefcaseBusiness, Gauge, LayoutTemplate, SearchCheck, ShieldAlert, Smartphone } from "lucide-react";

import { DashboardMockup } from "@/components/landing/dashboard-mockup";
import { EmailReportPreview } from "@/components/landing/email-report-preview";
import { FreeScanFunnel } from "@/components/landing/free-scan-funnel";
import { PricingGrid } from "@/components/landing/pricing-grid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useUser } from "@/hooks/useUser";
import { getPlanPricing, formatUsdPrice, type BillingPlanCatalog } from "@/lib/billing";
import { marketingCopy, marketingFaq } from "@/lib/marketing-copy";

const solutionPillars = [
  {
    title: "Automated audits",
    description: "Run the checks automatically so your team spends less time gathering proof and more time winning work."
  },
  {
    title: "Client-friendly insights",
    description: "Show clients what is wrong, why it matters, and what to fix without turning every review into a technical workshop."
  },
  {
    title: "White-label reports",
    description: "Deliver polished reports that reinforce your agency brand instead of looking like a third-party tool dump."
  },
  {
    title: "Business-focused explanations",
    description: "Connect performance, SEO, and usability problems to traffic, conversions, trust, and revenue."
  }
] as const;

const workflow = [
  {
    step: "1",
    title: "Enter website",
    description: "Paste a client site and let SitePulse run the first pass instantly."
  },
  {
    step: "2",
    title: "Get instant insights",
    description: "Surface the score, the biggest leaks, and the business impact before the call ends."
  },
  {
    step: "3",
    title: "Send reports",
    description: "Unlock a client-ready report you can use to close, retain, and upsell with confidence."
  }
] as const;

const repositionedFeatures = [
  {
    icon: SearchCheck,
    title: "Automated monitoring",
    description: "Keep scanning live in the background so every client account has proactive proof instead of reactive excuses."
  },
  {
    icon: LayoutTemplate,
    title: "White-label reports",
    description: "Turn raw scan results into branded deliverables that feel like part of your agency service, not borrowed software."
  },
  {
    icon: BriefcaseBusiness,
    title: "Business impact insights",
    description: "Translate technical issues into risk, conversion loss, SEO drag, and client-facing opportunity."
  },
  {
    icon: BellRing,
    title: "Alerts",
    description: "Know when scores drop, trust signals weaken, or problems start costing your clients attention."
  },
  {
    icon: Smartphone,
    title: "Device comparison",
    description: "Show how mobile and desktop experiences differ so clients understand where the biggest user pain starts."
  }
] as const;

export function AgencyGrowthHome({ plans }: { plans: BillingPlanCatalog }) {
  const { user } = useUser();
  const isAuthenticated = Boolean(user);
  const growthMonthlyPrice = getPlanPricing("starter", "monthly", plans).salePrice;
  const proofStats = [
    {
      label: "Free scan preview",
      value: "30 sec",
      note: isAuthenticated ? "Scan saved to your workspace" : "No-login first impression"
    },
    {
      label: "Client-ready proof",
      value: "1 click",
      note: isAuthenticated ? "View full report" : "Unlock the full report after signup"
    },
    { label: "Retention angle", value: "Weekly", note: "Ongoing value delivery after close" }
  ] as const;

  return (
    <main>
      <section className="mx-auto grid w-full max-w-[1480px] gap-14 px-5 py-12 sm:px-6 md:px-8 md:py-16 lg:grid-cols-[minmax(0,1.08fr)_minmax(440px,0.92fr)] lg:items-center lg:px-10 xl:px-14 xl:py-20">
        <div className="max-w-3xl">
          <Badge className="border-primary/20 bg-primary/10 text-primary">
            Client acquisition and retention system for agencies
          </Badge>
          <h1 className="mt-6 font-display text-4xl font-semibold leading-[0.98] sm:text-5xl lg:text-[4.4rem]">
            The SEO Audit Tool Built for Agencies
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
            {marketingCopy.subTagline}
          </p>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
            {marketingCopy.heroSubheadline}
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            {proofStats.map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-border/80 bg-card/75 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  {stat.label}
                </p>
                <p className="mt-2 font-display text-2xl font-semibold">{stat.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{stat.note}</p>
              </div>
            ))}
          </div>
        </div>

        <FreeScanFunnel />
      </section>

      <section className="container pb-10 md:pb-14">
        <div className="rounded-[2rem] border border-border/80 bg-card/70 p-6 shadow-[0_24px_70px_-50px_rgba(15,23,42,0.35)]">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] xl:items-center">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">Value demo</p>
              <h2 className="mt-3 font-display text-3xl font-semibold">Show the client the leak before they ask for a proposal</h2>
              <p className="mt-4 text-lg leading-8 text-muted-foreground">
                Your website is losing visitors due to slow load speed (9.6s). Fixing 3 issues could improve performance by up to 30%.
              </p>
              <p className="mt-4 text-sm leading-7 text-muted-foreground">
                This is the kind of sales-ready insight agencies need in the first meeting: clear problem, clear business cost, clear next step.
              </p>
            </div>
            <DashboardMockup />
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-muted/30">
        <div className="container py-16 md:py-20">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">Problem</p>
          <h2 className="mt-4 font-display text-4xl font-semibold">Agencies lose momentum in the handoff between audit, explanation, and follow-up.</h2>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">
            Manual audits eat hours, technical reports confuse clients, and weak communication makes valuable work feel invisible. SitePulse removes that drag so your team can sell with more authority and retain clients with less effort.
          </p>
        </div>
      </section>

      <section className="container py-16 md:py-20">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">Solution</p>
        <h2 className="mt-4 font-display text-4xl font-semibold">Everything your agency needs to look sharp, proactive, and high value.</h2>
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {solutionPillars.map((item) => (
            <Card key={item.title} className="theme-panel border-border/80">
              <CardContent className="p-6">
                <p className="text-lg font-semibold">{item.title}</p>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">{item.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-muted/20">
        <div className="container py-16 md:py-20">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">How it works</p>
          <h2 className="mt-4 font-display text-4xl font-semibold">From free scan to client-ready proof in three steps.</h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {workflow.map((item) => (
              <Card key={item.step} className="theme-panel border-border/80">
                <CardContent className="p-6">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 font-display text-xl font-semibold text-primary">
                    {item.step}
                  </div>
                  <p className="mt-5 text-xl font-semibold">{item.title}</p>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">{item.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="container py-16 md:py-20">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">Repositioned features</p>
        <h2 className="mt-4 font-display text-4xl font-semibold">A premium agency asset, not another technical dashboard.</h2>
        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-5">
          {repositionedFeatures.map((item) => {
            const Icon = item.icon;

            return (
              <Card key={item.title} className="theme-panel border-border/80">
                <CardContent className="p-6">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="mt-5 text-lg font-semibold">{item.title}</p>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">{item.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="border-y border-border bg-muted/25">
        <div className="container grid gap-8 py-14 md:gap-10 md:py-18 xl:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)] xl:items-center">
          <div className="max-w-2xl space-y-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">ROI</p>
            <h2 className="mt-4 font-display text-[2.2rem] font-semibold leading-tight md:text-[2.7rem]">
              Close one extra client and this pays for itself.
            </h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground md:text-lg md:leading-8">
              The real comparison is simple: one agency client can be worth $500 or more per month. SitePulse starts at {formatUsdPrice(growthMonthlyPrice)} per month. If it helps you close one deal or retain one shaky account, the return is obvious.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Badge variant="outline">Close 1 client = $500+</Badge>
              <Badge variant="outline">SitePulse = {formatUsdPrice(growthMonthlyPrice)}/month</Badge>
            </div>

            <div className="max-w-xl rounded-[1.6rem] border border-border/80 bg-card/75 p-5 md:p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">Retention angle</p>
              <p className="mt-3 text-lg font-semibold">Stay valuable after the close.</p>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                Use weekly reports, score movement, issue explanations, and action plans to prove that your agency is still protecting the client&apos;s revenue after the proposal is signed.
              </p>
            </div>
          </div>

          <div className="mx-auto w-full max-w-[620px] xl:mt-6 xl:justify-self-end xl:max-w-[660px]">
            <EmailReportPreview compact />
          </div>
        </div>
      </section>

      <section id="pricing" className="container py-10 md:py-12">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">Pricing</p>
        <h2 className="mt-3 max-w-4xl font-display text-[2.1rem] font-semibold leading-tight md:text-[2.45rem]">Plans framed around agency value, not tool complexity.</h2>
        <p className="mt-3 max-w-[50rem] text-[15px] leading-7 text-muted-foreground md:text-base">
          Position SitePulse as part of your revenue engine, not another software expense. Start with one free scan, then choose the plan that matches how you sell and scale.
        </p>
        <div className="mt-6">
          <PricingGrid plans={plans} compact />
        </div>
      </section>

      <section className="border-y border-border bg-muted/20">
        <div className="container py-16 md:py-20">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">FAQ</p>
          <h2 className="mt-4 font-display text-4xl font-semibold">Questions agencies ask before they roll this into their offer.</h2>
          <div className="mt-10 space-y-4">
            {marketingFaq.map((item) => (
              <details key={item.question} className="theme-panel rounded-[1.8rem] p-6">
                <summary className="cursor-pointer list-none font-display text-xl font-semibold">
                  {item.question}
                </summary>
                <p className="mt-4 text-sm leading-7 text-muted-foreground">{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="container pb-24 pt-16">
        <Card className="overflow-hidden border-primary/15 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.12),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))] dark:bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.18),transparent_42%),linear-gradient(180deg,rgba(30,41,59,0.96),rgba(15,23,42,0.92))]">
          <CardContent className="flex flex-col items-center gap-5 p-10 text-center md:p-14">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">Final CTA</p>
            <h2 className="font-display text-4xl font-semibold">Scan a website free and start the client conversation with proof.</h2>
            <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
              Use the free preview to start strong, unlock the full report after signup, and turn technical findings into a premium agency growth story.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="rounded-2xl px-6">
                <Link href={isAuthenticated ? "/dashboard" : "/#free-scan"}>
                  {isAuthenticated ? "Go to Dashboard" : "Scan a website (free)"}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-2xl px-6">
                <Link href="/pricing">See plan ROI</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
