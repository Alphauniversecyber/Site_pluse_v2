import type { Metadata } from "next";

import { AgencyGrowthHome } from "@/components/landing/agency-growth-home";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-json-ld";
import { getBillingPlans } from "@/lib/billing-config";
import { marketingFaq } from "@/lib/marketing-copy";
import { PUBLIC_SITE_URL, trimMetaDescription } from "@/lib/seo";

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
  name: "SitePulse \u2013 SEO Audit Tool for Digital Agencies",
  url: `${PUBLIC_SITE_URL}/`,
  description:
    "SitePulse helps digital agencies run automated SEO audits and deliver branded reports clients actually understand. Free 14-day trial. No credit card required.",
  isPartOf: {
    "@type": "WebSite",
    name: "SitePulse",
    url: `${PUBLIC_SITE_URL}/`
  },
  about: {
    "@type": "SoftwareApplication",
    name: "SitePulse"
  }
};

export const metadata: Metadata = {
  title: "SitePulse \u2013 SEO Audit Tool for Digital Agencies",
  description: trimMetaDescription(
    "SitePulse helps digital agencies run automated SEO audits and deliver branded reports clients actually understand. Free 14-day trial. No credit card required."
  ),
  alternates: {
    canonical: `${PUBLIC_SITE_URL}/`
  },
  openGraph: {
    title: "SitePulse \u2013 SEO Audit Tool for Digital Agencies",
    description: trimMetaDescription(
      "Automated SEO audit reports for digital agencies. White-label, client-ready, delivered weekly."
    ),
    url: `${PUBLIC_SITE_URL}/`,
    siteName: "SitePulse",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "SitePulse \u2013 SEO Audit Tool for Digital Agencies",
    description: trimMetaDescription(
      "Automated SEO audit reports for digital agencies. White-label, client-ready, delivered weekly."
    )
  }
};

export default async function LandingPage() {
  const plans = await getBillingPlans();

  return (
    <>
      <BreadcrumbJsonLd items={[{ name: "Home", item: `${PUBLIC_SITE_URL}/` }]} />
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
