import type { Metadata } from "next";

import { AgencyFeaturesPage } from "@/components/landing/agency-features-page";

export const metadata: Metadata = {
  title: "SEO Audit Features for Agencies",
  description:
    "Explore SitePulse features for agencies, including automated SEO audits, white-label reports, revenue leak detection, and client-ready workflows.",
  alternates: {
    canonical: "https://www.trysitepulse.com/features"
  }
};

export default function FeaturesPage() {
  return <AgencyFeaturesPage />;
}
