import type { Metadata } from "next";

import { ContactForm } from "@/components/landing/contact-form";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-json-ld";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Contact SitePulse",
  description:
    "Contact SitePulse for sales, partnerships, support, privacy requests, and questions about our SEO audit and reporting platform for agencies.",
  alternates: {
    canonical: "https://www.trysitepulse.com/contact"
  }
};

export default function ContactPage() {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", item: "https://www.trysitepulse.com" },
          { name: "Contact", item: "https://www.trysitepulse.com/contact" }
        ]}
      />
      <main className="container py-14 md:py-20">
        <div className="mx-auto max-w-4xl">
          <Badge>Contact</Badge>
          <h1 className="mt-6 font-display text-4xl font-semibold tracking-tight md:text-5xl">
            Contact SitePulse
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">
            Reach out if you need help evaluating SitePulse, setting up billing, or handling account
            and privacy requests.
          </p>

          <ContactForm />
        </div>
      </main>
    </>
  );
}
