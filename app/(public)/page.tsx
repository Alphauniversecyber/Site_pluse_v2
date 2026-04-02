import Link from "next/link";
import { ArrowRight, Check, Link2, MailCheck, Radar, X } from "lucide-react";

import { DashboardMockup } from "@/components/landing/dashboard-mockup";
import { EmailReportPreview } from "@/components/landing/email-report-preview";
import { FeatureOrbIcon } from "@/components/landing/feature-orb-icon";
import { PricingGrid } from "@/components/landing/pricing-grid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { landingFaq, siteCopy } from "@/lib/copy";

const features = [
  {
    kind: "scanning",
    title: "Automated Scanning",
    description:
      "Weekly scans run automatically. No logging in, no manual triggers. Just results in your inbox."
  },
  {
    kind: "pdf",
    title: "White-Label PDF Reports",
    description:
      "Send clients professional reports with your logo and branding. It feels like part of your own service."
  },
  {
    kind: "accessibility",
    title: "Accessibility Monitoring",
    description:
      "The only monitoring workflow here that checks WCAG accessibility compliance without adding another specialist tool."
  },
  {
    kind: "alerts",
    title: "Instant Alerts",
    description:
      "Score drops by 10 points? Site goes below 50? You hear about it before your client does."
  },
  {
    kind: "trends",
    title: "Score Trend Graphs",
    description:
      "See exactly how scores change over time and show clients the progress your work is driving."
  },
  {
    kind: "seo",
    title: "Mobile vs Desktop",
    description: "Separate scores for mobile and desktop because real-world website quality depends on both."
  }
] as const;

const painPoints = [
  {
    emoji: "\u{1F624}",
    copy: "\"I manually check 15 client sites every month and it takes forever\""
  },
  {
    emoji: "\u{1F630}",
    copy: "\"My client's Google ranking dropped and I had no idea until they called me angry\""
  },
  {
    emoji: "\u{1F613}",
    copy: "\"I have no way to show clients what I do for them every month\""
  }
] as const;

const comparisonRows = [
  {
    feature: "Weekly branded reports",
    values: ["Automated", "Manual exports", "DIY templates", "Usually missing"]
  },
  {
    feature: "Performance, SEO, and accessibility",
    values: ["One workflow", "Split across tools", "Split across tools", "Rarely tracked"]
  },
  {
    feature: "White-label delivery",
    values: ["Included", "Extra work", "Manual design", "None"]
  },
  {
    feature: "Client confidence",
    values: ["Consistent", "Depends on team time", "Depends on process", "Reactive only"]
  },
  {
    feature: "Time spent each week",
    values: ["Minutes", "Hours", "Hours", "Zero until something breaks"]
  },
  {
    feature: "Alerts before client calls",
    values: ["Built in", "Manual checks", "Inconsistent", "Not available"]
  }
] as const;

const howItWorksSteps = [
  {
    icon: Link2,
    step: "01",
    title: "Add your client websites",
    description: "Paste the URL, label the site, and keep moving."
  },
  {
    icon: Radar,
    step: "02",
    title: "We scan automatically",
    description: "Performance, SEO, accessibility, and best-practice checks run quietly in the background."
  },
  {
    icon: MailCheck,
    step: "03",
    title: "Reports land in your inbox",
    description: "Beautiful PDF reports are ready for you and your clients without another export workflow."
  }
] as const;

const testimonials = [
  {
    quote:
      "I used to spend 4 hours every month manually checking client sites. Now SitePulse does it while I sleep and my clients get beautiful reports automatically.",
    author: "Sarah M., Web Agency Owner, London"
  },
  {
    quote:
      "The white-label reports alone are worth the price. My clients think I built a custom reporting system for them.",
    author: "James K., Freelance Developer, Australia"
  },
  {
    quote:
      "We caught a client's Core Web Vitals drop before they even noticed. Saved the relationship. Worth every penny.",
    author: "David R., Digital Agency, Canada"
  }
] as const;

export default function LandingPage() {
  return (
    <main>
      <section className="mx-auto grid w-full max-w-[1440px] gap-12 px-5 py-12 sm:px-6 md:px-8 md:py-16 lg:min-h-[calc(100vh-5rem)] lg:grid-cols-2 lg:items-center lg:gap-16 lg:px-10 lg:py-10 xl:px-14 xl:py-14">
        <div className="relative max-w-2xl lg:py-8">
          <Badge>Automated white-label reporting for agencies</Badge>
          <h1 className="mt-6 max-w-2xl font-display text-4xl font-semibold leading-[1.02] sm:text-5xl lg:text-[3.8rem]">
            Know when client sites break before they call.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-muted-foreground">
            Automated white-label website reports for agencies. Monitor performance, accessibility, and SEO across
            client websites, then send branded reports automatically.
          </p>
          <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground">{siteCopy.positioning}</p>
          <div className="mt-7 flex flex-col gap-4 sm:flex-row sm:flex-wrap">
            <Button
              asChild
              size="lg"
              className="h-12 w-full rounded-2xl px-6 text-base shadow-[0_20px_42px_-22px_rgba(59,130,246,0.95)] sm:w-auto"
            >
              <Link href="/signup">
                Start free
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12 w-full rounded-2xl px-6 text-base sm:w-auto">
              <Link href="/features#report-preview">See sample report</Link>
            </Button>
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            Built for agencies, freelancers, and website maintenance retainers.
          </p>

          <p className="mt-8 text-sm text-muted-foreground">{siteCopy.socialProof}</p>
        </div>
        <div className="flex justify-center lg:justify-end lg:pl-8">
          <DashboardMockup />
        </div>
      </section>

      <section id="report-preview" className="container py-10 md:py-14">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-primary">Report preview</p>
            <h2 className="mt-4 font-display text-4xl font-semibold">Client-ready reporting without the manual deck building</h2>
            <p className="mt-4 text-lg leading-8 text-muted-foreground">
              Weekly email reports surface score changes, key issues, and next actions clearly enough for clients and
              fast enough for busy agency workflows.
            </p>
          </div>
          <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
            White-label ready
          </Badge>
        </div>
        <div className="mx-auto mt-8 max-w-5xl">
          <EmailReportPreview />
        </div>
      </section>

      <section className="border-y border-border bg-muted/35">
        <div className="container py-20">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-primary">Sound familiar?</p>
          <h2 className="mt-4 font-display text-4xl font-semibold">The work is valuable. The reporting overhead is not.</h2>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-muted-foreground">
            SitePulse is built for agencies that want clients to feel looked after without adding another recurring
            admin task every week.
          </p>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {painPoints.map((item) => (
              <Card key={item.copy} className="theme-panel">
                <CardContent className="p-6 text-lg leading-relaxed">
                  <div className="flex items-start gap-4">
                    <span className="text-2xl">{item.emoji}</span>
                    <div>
                      <p className="font-medium text-foreground">{item.copy}</p>
                      <p className="mt-3 text-sm leading-6 text-muted-foreground">
                        SitePulse automates the checks, reporting, and follow-up signals so your team can focus on fixes instead of status updates.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="mt-8 text-lg text-primary">SitePulse fixes all of this automatically.</p>
        </div>
      </section>

      <section className="container py-20">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-primary">How it works</p>
        <h2 className="mt-4 font-display text-4xl font-semibold">Set up in 2 minutes. Reports run themselves.</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {howItWorksSteps.map((step) => {
            const StepIcon = step.icon;
            return (
              <Card key={step.step} className="theme-panel">
                <CardHeader>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <StepIcon className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">{step.step}</p>
                  <CardTitle>{step.title}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 text-muted-foreground">{step.description}</CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="border-y border-border bg-muted/20">
        <div className="container py-20">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-primary">Features</p>
          <h2 className="mt-4 font-display text-4xl font-semibold">Everything agencies need. Nothing they do not.</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {features.map((feature) => (
              <Card key={feature.title} className="feature-card group border-border/80">
                <CardHeader className="gap-5">
                  <FeatureOrbIcon kind={feature.kind} />
                  <CardTitle className="text-2xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 text-muted-foreground">{feature.description}</CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="container py-20">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-primary">Comparison</p>
            <h2 className="mt-4 font-display text-4xl font-semibold">
              Better than juggling checks, spreadsheets, and client follow-ups by hand
            </h2>
            <p className="mt-3 text-muted-foreground">
              The real alternative is usually manual reporting, tool sprawl, or no proactive reporting at all.
            </p>
          </div>
        </div>
        <div className="mt-10 overflow-x-auto rounded-[2rem] border border-border bg-card">
          <table className="w-full min-w-[820px]">
            <thead className="bg-muted/60">
              <tr>
                {["Workflow", "SitePulse", "Manual reporting", "Lighthouse + spreadsheets", "No reporting"].map((head) => (
                  <th key={head} className="px-6 py-4 text-left text-xs uppercase tracking-[0.24em] text-muted-foreground">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row) => (
                <tr key={row.feature} className="border-t border-border">
                  <td className="px-6 py-4 text-sm font-medium text-foreground">{row.feature}</td>
                  {row.values.map((cell, index) => (
                    <td key={`${row.feature}-${cell}-${index}`} className="px-6 py-4 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-2">
                        {index === 0 ? (
                          <Check className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <X className="h-4 w-4 text-rose-500/80" />
                        )}
                        <span className={index === 0 ? "font-medium text-foreground" : ""}>{cell}</span>
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="border-y border-border bg-muted/30">
        <div className="container grid gap-10 py-20 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-primary">Agency reseller angle</p>
            <h2 className="mt-4 font-display text-4xl font-semibold">Turn monitoring into a revenue stream</h2>
            <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
              Charge your clients $99-199/month for website monitoring. SitePulse Agency plan costs you $149/month for up to 30 sites. The math works in your favor.
            </p>
            <Button asChild size="lg" className="mt-8">
              <Link href="/signup">
                Start Making Money From Monitoring
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
          <Card className="theme-panel border-border/80 transition duration-300 ease-out hover:-translate-y-1 hover:border-primary/25 hover:shadow-[0_28px_70px_-34px_rgba(59,130,246,0.26),0_0_0_1px_rgba(96,165,250,0.14)]">
            <CardHeader>
              <CardTitle>Profit calculator</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-lg">
              <div className="flex items-center justify-between rounded-2xl bg-background p-4">
                <span>10 clients x $99/month</span>
                <span className="font-semibold">$990</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-background p-4">
                <span>SitePulse Agency plan</span>
                <span className="font-semibold">$149</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-primary/10 p-4 text-primary">
                <span>Your profit</span>
                <span className="font-display text-3xl font-semibold">$841/month</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section id="pricing" className="container py-20">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-primary">Pricing</p>
        <h2 className="mt-4 font-display text-4xl font-semibold">Simple pricing. No surprises.</h2>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-muted-foreground">
          Compare the essentials at a glance, then upgrade when your reporting workflow starts paying for itself.
        </p>
        <div className="mt-10">
          <PricingGrid />
        </div>
        <p className="mt-8 text-center text-sm text-muted-foreground">
          All plans include 14-day free trial. Cancel anytime. No contracts.
        </p>
      </section>

      <section className="border-y border-border bg-muted/20">
        <div className="container py-20">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-primary">Testimonials</p>
          <h2 className="mt-4 font-display text-4xl font-semibold">Agencies love SitePulse</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {testimonials.map((testimonial) => (
              <Card key={testimonial.author} className="theme-panel">
                <CardContent className="space-y-6 p-6">
                  <p className="text-lg leading-relaxed text-foreground">&ldquo;{testimonial.quote}&rdquo;</p>
                  <p className="text-sm text-muted-foreground">- {testimonial.author}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="container py-20">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-primary">FAQ</p>
        <h2 className="mt-4 font-display text-4xl font-semibold">Questions agencies ask us most</h2>
        <div className="mt-10 space-y-4">
          {landingFaq.map((item) => (
            <details key={item.question} className="theme-panel rounded-3xl p-6">
              <summary className="cursor-pointer list-none font-display text-xl font-semibold">{item.question}</summary>
              <p className="mt-4 text-muted-foreground">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="container pb-24">
        <Card className="overflow-hidden border-primary/15 bg-gradient-to-r from-primary/15 via-card to-card">
          <CardContent className="flex flex-col gap-6 p-10 text-center md:p-14">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-primary">Final CTA</p>
            <h2 className="font-display text-4xl font-semibold">Start monitoring your client sites today</h2>
            <p className="mx-auto max-w-xl text-lg text-muted-foreground">Free forever for 1 site. No credit card required.</p>
            <Button asChild size="lg" className="mx-auto">
              <Link href="/signup">
                Create Free Account
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
