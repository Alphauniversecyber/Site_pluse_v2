import type { Metadata } from "next";

import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-json-ld";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildPageMetadata, PUBLIC_SITE_URL } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "SitePulse Product Changelog",
  description:
    "Read the latest SitePulse product updates, including new SEO audit workflows, reporting improvements, billing changes, and agency features.",
  path: "/changelog",
  keywords: [
    "SitePulse changelog",
    "SEO audit software updates",
    "agency reporting platform updates",
    "product updates SitePulse"
  ],
  imageAlt: "SitePulse changelog page preview"
});

const updates = [
  {
    title: "Authenticated landing flow",
    date: "April 2026",
    details:
      "Signed-in agencies can save scans directly to their account, jump into dashboard scan views, and see personalized navigation on the marketing site."
  },
  {
    title: "Template-based PDF reports",
    date: "April 2026",
    details:
      "Monthly reports now use a stricter fixed-page template with clearer executive summaries, security coverage, and more stable PDF rendering."
  },
  {
    title: "Paddle billing rollout",
    date: "April 2026",
    details:
      "Growth and Pro subscriptions now run exclusively through Paddle, with sale pricing, subscription lifecycle webhooks, and admin payment monitoring."
  }
] as const;

const changelogSchema = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "SitePulse Product Changelog",
  url: `${PUBLIC_SITE_URL}/changelog`,
  mainEntity: {
    "@type": "ItemList",
    itemListElement: updates.map((update, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: update.title,
      description: update.details
    }))
  }
};

export default function ChangelogPage() {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", item: PUBLIC_SITE_URL },
          { name: "Changelog", item: `${PUBLIC_SITE_URL}/changelog` }
        ]}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(changelogSchema) }}
      />
      <main className="container py-14 md:py-20">
        <div className="mx-auto max-w-4xl">
          <Badge>Product updates</Badge>
          <h1 className="mt-6 font-display text-4xl font-semibold tracking-tight md:text-5xl">
            SitePulse Product Changelog
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">
            Follow the latest improvements across monitoring, reporting, billing, and
            client-delivery workflows.
          </p>

          <div className="mt-10 space-y-6">
            {updates.map((update) => (
              <Card key={update.title} className="border-border/80">
                <CardHeader>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
                    {update.date}
                  </p>
                  <CardTitle>{update.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-7 text-muted-foreground">{update.details}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
