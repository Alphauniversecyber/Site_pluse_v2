import Link from "next/link";

import { DashboardMockup } from "@/components/landing/dashboard-mockup";
import { EmailReportPreview } from "@/components/landing/email-report-preview";
import { FeatureOrbIcon } from "@/components/landing/feature-orb-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const featureGroups = [
  {
    kind: "scanning",
    title: "Automated Scanning",
    body: "Weekly scans run automatically. No logging in, no manual triggers. Just results in your inbox."
  },
  {
    kind: "pdf",
    title: "White-Label PDF Reports",
    body: "Send clients professional reports with YOUR logo and branding. They'll think you built it yourself."
  },
  {
    kind: "accessibility",
    title: "Accessibility Monitoring",
    body: "The only monitoring tool that checks WCAG accessibility compliance — increasingly required by law."
  },
  {
    kind: "alerts",
    title: "Instant Alerts",
    body: "Score drops by 10 points? Site goes below 50? You get an email immediately — before your client notices."
  },
  {
    kind: "trends",
    title: "Score Trend Graphs",
    body: "See exactly how scores change over time. Prove your work is making a difference."
  },
  {
    kind: "seo",
    title: "Mobile vs Desktop",
    body: "Separate scores for mobile and desktop — because Google cares about both."
  }
] as const;

export default function FeaturesPage() {
  return (
    <main className="container py-20">
      <div className="grid gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
        <div>
          <Badge>Everything agencies need. Nothing they don&apos;t.</Badge>
          <h1 className="mt-6 font-display text-5xl font-semibold">
            Agency-friendly monitoring without enterprise SEO bloat
          </h1>
          <p className="mt-6 text-lg text-muted-foreground">
            SitePulse is built for agencies managing 5-20 client sites, freelance developers, WordPress maintenance providers, and marketers who need proof, not complexity.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Button asChild size="lg">
              <Link href="/signup">Start Free</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/pricing">Compare plans</Link>
            </Button>
          </div>
        </div>
        <DashboardMockup />
      </div>

      <div className="mt-20 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {featureGroups.map((feature) => (
          <Card key={feature.title} className="theme-panel">
            <CardHeader className="gap-5">
              <FeatureOrbIcon kind={feature.kind} className="h-20 w-20" />
              <CardTitle className="text-2xl">{feature.title}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-muted-foreground">{feature.body}</CardContent>
          </Card>
        ))}
      </div>

      <section id="report-preview" className="mt-20">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
              Report Preview
            </Badge>
            <h2 className="mt-5 font-display text-4xl font-semibold">The email your clients actually want to receive</h2>
            <p className="mt-4 max-w-3xl text-lg text-muted-foreground">
              White-label weekly reports surface the four core scores, score changes, accessibility issue counts, and the top fixes to make next.
            </p>
          </div>
          <div className="grid gap-3 text-sm text-muted-foreground md:text-right">
            <span>Agency logo + custom brand color</span>
            <span>Mobile and desktop comparisons</span>
            <span>Top issues with a dashboard deep link</span>
          </div>
        </div>
        <div className="mt-10">
          <EmailReportPreview />
        </div>
      </section>
    </main>
  );
}
