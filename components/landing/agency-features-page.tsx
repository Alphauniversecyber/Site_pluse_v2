import Link from "next/link";
import { BellRing, BriefcaseBusiness, LayoutTemplate, SearchCheck, Smartphone, TrendingUp } from "lucide-react";

import { DashboardMockup } from "@/components/landing/dashboard-mockup";
import { EmailReportPreview } from "@/components/landing/email-report-preview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { marketingCopy } from "@/lib/marketing-copy";

const featureGroups = [
  {
    icon: SearchCheck,
    title: "Automated monitoring",
    body: "Run recurring audits without turning your account managers into manual QA staff."
  },
  {
    icon: LayoutTemplate,
    title: "White-label reports",
    body: "Deliver premium reports that feel native to your agency, not borrowed from a generic tool."
  },
  {
    icon: BriefcaseBusiness,
    title: "Business impact insights",
    body: "Explain the commercial cost of website issues so clients see why action matters."
  },
  {
    icon: BellRing,
    title: "Alerts that support retention",
    body: "Know about drops, failures, and risk before the client gets frustrated or starts questioning value."
  },
  {
    icon: Smartphone,
    title: "Device comparison",
    body: "Show where mobile visitors are having a worse experience so the client understands the opportunity clearly."
  },
  {
    icon: TrendingUp,
    title: "Proof of improvement",
    body: "Track score movement over time so every fix can be tied back to visible progress."
  }
] as const;

export function AgencyFeaturesPage() {
  return (
    <main className="container py-16 md:py-20">
      <div className="grid gap-12 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
        <div>
          <Badge>Agency growth features</Badge>
          <h1 className="mt-6 font-display text-5xl font-semibold">{marketingCopy.tagline}</h1>
          <p className="mt-6 text-lg leading-8 text-muted-foreground">{marketingCopy.positioning}</p>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            Every feature is designed to help agencies close more clients, retain them longer, and look more premium while doing it.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Button asChild size="lg">
              <Link href="/#free-scan">Scan a website (free)</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/pricing">See plan ROI</Link>
            </Button>
          </div>
        </div>
        <DashboardMockup />
      </div>

      <div className="mt-20 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {featureGroups.map((feature) => {
          const Icon = feature.icon;

          return (
            <Card key={feature.title} className="theme-panel border-border/80">
              <CardContent className="p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <p className="mt-5 text-2xl font-semibold">{feature.title}</p>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">{feature.body}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <section id="report-preview" className="mt-20">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
              Client-ready proof
            </Badge>
            <h2 className="mt-5 font-display text-4xl font-semibold">The report your agency uses to win trust fast.</h2>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-muted-foreground">
              SitePulse takes raw website data and turns it into a clear client story: what is wrong, why it matters to the business, and what should happen next.
            </p>
          </div>
          <div className="grid gap-3 text-sm text-muted-foreground md:text-right">
            <span>Client-friendly language</span>
            <span>Business impact framing</span>
            <span>White-label delivery</span>
          </div>
        </div>
        <div className="mt-10">
          <EmailReportPreview />
        </div>
      </section>
    </main>
  );
}
