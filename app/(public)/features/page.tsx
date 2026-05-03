import type { Metadata } from "next";

import { AgencyFeaturesPage } from "@/components/landing/agency-features-page";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-json-ld";

export const metadata: Metadata = {
  title: "Features — SitePulse",
  description:
    "Explore SitePulse features for agencies, including automated SEO audits, white-label reports, revenue leak detection, and client-ready workflows.",
  alternates: {
    canonical: "https://www.trysitepulse.com/features"
  }
};

export default function FeaturesPage() {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", item: "https://www.trysitepulse.com" },
          { name: "Features", item: "https://www.trysitepulse.com/features" }
        ]}
      />
      <AgencyFeaturesPage />
    </>
  );
}
