import type { Metadata } from "next";

import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-json-ld";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "SitePulse Product Roadmap",
  description:
    "See the SitePulse product roadmap for upcoming SEO audit, reporting, retention, and agency workflow improvements.",
  alternates: {
    canonical: "https://www.trysitepulse.com/roadmap"
  }
};

const roadmapItems = [
  {
    title: "Client-ready benchmarking",
    status: "Planned next",
    details:
      "Expanded competitor comparisons, benchmark narratives, and account-level proof points for agencies selling retainers."
  },
  {
    title: "Agency delivery automation",
    status: "In design",
    details:
      "More automated report scheduling, approval workflows, and white-label delivery controls for multi-client teams."
  },
  {
    title: "Retention intelligence",
    status: "Exploring",
    details:
      "Renewal-risk indicators, client health summaries, and stronger action prompts to help agencies defend monthly revenue."
  }
] as const;

export default function RoadmapPage() {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", item: "https://www.trysitepulse.com" },
          { name: "Roadmap", item: "https://www.trysitepulse.com/roadmap" }
        ]}
      />
      <main className="container py-14 md:py-20">
        <div className="mx-auto max-w-4xl">
          <Badge>What&apos;s next</Badge>
          <h1 className="mt-6 font-display text-4xl font-semibold tracking-tight md:text-5xl">
            SitePulse Product Roadmap
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">
            The roadmap is focused on making SitePulse more valuable as an agency growth system, not
            just a monitoring dashboard.
          </p>

          <div className="mt-10 grid gap-6">
            {roadmapItems.map((item) => (
              <Card key={item.title} className="border-border/80">
                <CardHeader>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
                    {item.status}
                  </p>
                  <CardTitle>{item.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-7 text-muted-foreground">{item.details}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
