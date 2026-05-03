import type { Metadata } from "next";

import { AgencyGrowthHome } from "@/components/landing/agency-growth-home";
import { getBillingPlans } from "@/lib/billing-config";

export const metadata: Metadata = {
  title: "SitePulse — SEO Audit & Reporting Tool for Agencies",
  description:
    "Turn website audits into paying clients with SitePulse. Generate white-label SEO reports, uncover revenue leaks, and prove agency value automatically.",
  alternates: {
    canonical: "https://www.trysitepulse.com"
  }
};

export default async function LandingPage() {
  const plans = await getBillingPlans();

  return <AgencyGrowthHome plans={plans} />;
}
