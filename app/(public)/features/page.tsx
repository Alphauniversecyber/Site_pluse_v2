import type { Metadata } from "next";

import { AgencyFeaturesPage } from "@/components/landing/agency-features-page";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-json-ld";
import { buildPageMetadata, PUBLIC_SITE_URL } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Features - SitePulse SEO Audit Platform for Agencies",
  description:
    "Explore SitePulse features for agencies, including automated SEO audits, white-label reports, business-impact insights, retention alerts, and client-ready workflows.",
  path: "/features",
  keywords: [
    "SEO audit platform features",
    "white-label SEO reports",
    "automated website audits",
    "client reporting dashboard",
    "agency SEO software features",
    "SEO monitoring alerts"
  ],
  imageAlt: "SitePulse features page preview"
});

const featurePageSchema = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "SitePulse Features",
  url: `${PUBLIC_SITE_URL}/features`,
  description:
    "Explore SitePulse features for agencies, including automated SEO audits, white-label reports, business-impact insights, retention alerts, and client-ready workflows.",
  isPartOf: {
    "@type": "WebSite",
    name: "SitePulse",
    url: PUBLIC_SITE_URL
  }
};

export default function FeaturesPage() {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", item: PUBLIC_SITE_URL },
          { name: "Features", item: `${PUBLIC_SITE_URL}/features` }
        ]}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(featurePageSchema) }}
      />
      <AgencyFeaturesPage />
    </>
  );
}
