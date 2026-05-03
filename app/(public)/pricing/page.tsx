import type { Metadata } from "next";

import { AgencyPricingPage } from "@/components/landing/agency-pricing-page";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-json-ld";

export const metadata: Metadata = {
  title: "Pricing — SitePulse",
  description:
    "Compare SitePulse pricing for agencies and start a 14-day free trial. Choose the SEO audit and reporting plan that fits your client workflow.",
  alternates: {
    canonical: "https://www.trysitepulse.com/pricing"
  }
};

export default function PricingPage() {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", item: "https://www.trysitepulse.com" },
          { name: "Pricing", item: "https://www.trysitepulse.com/pricing" }
        ]}
      />
      <AgencyPricingPage />
    </>
  );
}
