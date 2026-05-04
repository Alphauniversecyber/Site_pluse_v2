import type { Metadata } from "next";

import { AgencyPricingPage } from "@/components/landing/agency-pricing-page";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-json-ld";
import { getPlanPricing } from "@/lib/billing";
import { getBillingPlans } from "@/lib/billing-config";

export const metadata: Metadata = {
  title: "Pricing – SitePulse SEO Audit Tool for Agencies",
  description:
    "Compare SitePulse pricing for digital agencies. Start with a free scan, then choose the plan for automated SEO audits, white-label PDF reports, and client dashboards.",
  keywords: [
    "SitePulse pricing",
    "SEO audit software pricing",
    "agency SEO tool pricing",
    "white-label SEO report pricing",
    "digital agency SEO software",
    "client reporting SaaS pricing"
  ],
  alternates: {
    canonical: "https://trysitepulse.com/pricing"
  },
  openGraph: {
    title: "Pricing – SitePulse SEO Audit Tool for Agencies",
    description:
      "Compare SitePulse pricing for digital agencies and start a 14-day free trial for automated SEO audits and white-label reporting.",
    url: "https://trysitepulse.com/pricing",
    siteName: "SitePulse",
    type: "website",
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "SitePulse pricing page preview"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "Pricing – SitePulse SEO Audit Tool for Agencies",
    description:
      "Compare SitePulse pricing for digital agencies and start a 14-day free trial for automated SEO audits and white-label reporting.",
    images: ["/opengraph-image.png"]
  },
  robots: {
    index: true,
    follow: true
  }
};

export default async function PricingPage() {
  const plans = await getBillingPlans();
  const starterMonthly = getPlanPricing("starter", "monthly", plans);
  const agencyMonthly = getPlanPricing("agency", "monthly", plans);

  const pricingWebPageSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "SitePulse Pricing",
    url: "https://trysitepulse.com/pricing",
    description:
      "Compare SitePulse pricing for digital agencies. Start with a free scan, then choose the plan for automated SEO audits, white-label PDF reports, and client dashboards.",
    isPartOf: {
      "@type": "WebSite",
      name: "SitePulse",
      url: "https://trysitepulse.com"
    }
  };

  const offerCatalogSchema = {
    "@context": "https://schema.org",
    "@type": "OfferCatalog",
    name: "SitePulse Pricing Plans",
    url: "https://trysitepulse.com/pricing",
    itemListElement: [
      {
        "@type": "Offer",
        name: starterMonthly.displayName,
        description: "Automated SEO audits and white-label reporting for growing digital agencies.",
        price: starterMonthly.salePrice,
        priceCurrency: "USD",
        url: "https://trysitepulse.com/pricing",
        category: "SEO audit SaaS",
        eligibleDuration: "P14D",
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          price: starterMonthly.salePrice,
          priceCurrency: "USD",
          billingIncrement: 1,
          unitText: "MONTH"
        }
      },
      {
        "@type": "Offer",
        name: agencyMonthly.displayName,
        description: "Advanced agency plan for scaling audits, client reporting, and premium delivery.",
        price: agencyMonthly.salePrice,
        priceCurrency: "USD",
        url: "https://trysitepulse.com/pricing",
        category: "SEO audit SaaS",
        eligibleDuration: "P14D",
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          price: agencyMonthly.salePrice,
          priceCurrency: "USD",
          billingIncrement: 1,
          unitText: "MONTH"
        }
      }
    ]
  };

  const pricingSummarySchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "SitePulse",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "AggregateOffer",
      lowPrice: starterMonthly.salePrice,
      highPrice: agencyMonthly.salePrice,
      priceCurrency: "USD",
      offerCount: 2
    }
  };

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", item: "https://trysitepulse.com" },
          { name: "Pricing", item: "https://trysitepulse.com/pricing" }
        ]}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pricingWebPageSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(offerCatalogSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pricingSummarySchema) }}
      />
      <AgencyPricingPage />
    </>
  );
}
