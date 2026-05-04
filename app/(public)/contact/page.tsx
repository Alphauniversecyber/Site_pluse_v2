import type { Metadata } from "next";

import { ContactForm } from "@/components/landing/contact-form";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-json-ld";
import { Badge } from "@/components/ui/badge";
import { buildPageMetadata, PUBLIC_SITE_URL } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Contact SitePulse - Sales, Support, and Agency Questions",
  description:
    "Contact SitePulse for sales, partnerships, support, privacy requests, and questions about our SEO audit and white-label reporting platform for agencies.",
  path: "/contact",
  keywords: [
    "contact SitePulse",
    "SEO audit software support",
    "agency reporting software contact",
    "SitePulse sales",
    "SitePulse partnerships"
  ],
  imageAlt: "Contact SitePulse page preview"
});

const contactPageSchema = {
  "@context": "https://schema.org",
  "@type": "ContactPage",
  name: "Contact SitePulse",
  url: `${PUBLIC_SITE_URL}/contact`,
  description:
    "Contact SitePulse for sales, partnerships, support, privacy requests, and questions about our SEO audit and white-label reporting platform for agencies.",
  mainEntity: {
    "@type": "Organization",
    name: "SitePulse",
    url: PUBLIC_SITE_URL
  }
};

export default function ContactPage() {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", item: PUBLIC_SITE_URL },
          { name: "Contact", item: `${PUBLIC_SITE_URL}/contact` }
        ]}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(contactPageSchema) }}
      />
      <main className="container py-14 md:py-20">
        <div className="mx-auto max-w-4xl">
          <Badge>Contact</Badge>
          <h1 className="mt-6 font-display text-4xl font-semibold tracking-tight md:text-5xl">
            Contact SitePulse
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">
            Reach out if you need help evaluating SitePulse, setting up billing, or handling
            account and privacy requests.
          </p>

          <ContactForm />
        </div>
      </main>
    </>
  );
}
