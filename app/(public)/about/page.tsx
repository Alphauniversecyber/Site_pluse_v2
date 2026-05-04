import type { Metadata } from "next";

import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-json-ld";
import { buildPageMetadata, PUBLIC_SITE_URL } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "About SitePulse - SEO Audit Software for Digital Agencies",
  description:
    "Learn how SitePulse helps digital agencies turn website audits into client-ready proof with automated SEO scans and white-label reporting.",
  path: "/about",
  keywords: [
    "about SitePulse",
    "SEO audit software for agencies",
    "white-label reporting platform",
    "digital agency SEO tools",
    "client-ready SEO reports"
  ],
  imageAlt: "About SitePulse page preview"
});

const aboutPageSchema = {
  "@context": "https://schema.org",
  "@type": "AboutPage",
  name: "About SitePulse",
  url: `${PUBLIC_SITE_URL}/about`,
  description:
    "Learn how SitePulse helps digital agencies turn website audits into client-ready proof with automated SEO scans and white-label reporting.",
  mainEntity: {
    "@type": "Organization",
    name: "SitePulse",
    url: PUBLIC_SITE_URL
  }
};

export default function AboutPage() {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", item: PUBLIC_SITE_URL },
          { name: "About", item: `${PUBLIC_SITE_URL}/about` }
        ]}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutPageSchema) }}
      />
      <main className="container py-14 md:py-20">
        <div className="mx-auto max-w-4xl">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
            About
          </p>
          <h1 className="mt-6 font-display text-4xl font-semibold tracking-tight md:text-5xl">
            About SitePulse
          </h1>
          <div className="mt-6 space-y-5 text-base leading-8 text-muted-foreground md:text-lg">
            <p>
              SitePulse is built for digital agencies that need a faster way to audit websites,
              explain issues clearly, and turn technical work into visible client value. Instead of
              handing over confusing exports or generic dashboards, teams can generate polished SEO
              reports that support sales, renewals, and ongoing account management.
            </p>
            <p>
              The platform combines automated scanning, white-label reporting, and business-focused
              issue framing so agencies can show what changed, why it matters, and what should
              happen next. That makes SitePulse useful both before a prospect signs and after a
              client is already on retainer.
            </p>
            <p>
              Our goal is simple: help agencies spend less time formatting audit findings and more
              time using those insights to win trust, protect revenue, and grow stronger recurring
              relationships with clients.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
