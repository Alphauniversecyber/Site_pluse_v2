import type { Metadata } from "next";

import { AgencyGrowthHome } from "@/components/landing/agency-growth-home";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-json-ld";
import { getBillingPlans } from "@/lib/billing-config";
import { marketingFaq } from "@/lib/marketing-copy";

const homeFaqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: marketingFaq.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.answer
    }
  }))
};

const homeWebPageSchema = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "SitePulse – SEO Audit Tool for Digital Agencies",
  url: "https://trysitepulse.com",
  description:
    "Automated SEO audits and white-label PDF reports for agencies. Share results with clients via magic-link dashboards. Try free for 14 days.",
  isPartOf: {
    "@type": "WebSite",
    name: "SitePulse",
    url: "https://trysitepulse.com"
  },
  about: {
    "@type": "SoftwareApplication",
    name: "SitePulse"
  }
};

export const metadata: Metadata = {
  title: "SitePulse – SEO Audit Tool for Digital Agencies",
  description:
    "Automated SEO audits and white-label PDF reports for agencies. Run website audits, generate white-label reports, and share results with clients using magic-link dashboards.",
  keywords: [
    "SEO audit tool for digital agencies",
    "automated SEO audits",
    "white-label SEO reports",
    "agency SEO reporting",
    "client SEO dashboards",
    "magic link client portal",
    "website audit software",
    "Search Console reporting software",
    "GA4 agency reporting",
    "SEO SaaS for agencies"
  ],
  alternates: {
    canonical: "https://trysitepulse.com"
  },
  openGraph: {
    title: "SitePulse – SEO Audit Tool for Digital Agencies",
    description:
      "Automated SEO audits and white-label PDF reports for agencies. Share results with clients via magic-link dashboards. Try free for 14 days.",
    url: "https://trysitepulse.com",
    siteName: "SitePulse",
    type: "website",
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "SitePulse homepage preview"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "SitePulse – SEO Audit Tool for Digital Agencies",
    description:
      "Automated SEO audits and white-label PDF reports for agencies. Share results with clients via magic-link dashboards. Try free for 14 days.",
    images: ["/opengraph-image.png"]
  },
  robots: {
    index: true,
    follow: true
  }
};

export default async function LandingPage() {
  const plans = await getBillingPlans();

  return (
    <>
      <BreadcrumbJsonLd items={[{ name: "Home", item: "https://trysitepulse.com" }]} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homeWebPageSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homeFaqSchema) }}
      />
      <AgencyGrowthHome plans={plans} />
    </>
  );
}
