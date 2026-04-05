import { AgencyFeaturesPage } from "@/components/landing/agency-features-page";

import { DashboardMockup } from "@/components/landing/dashboard-mockup";
import { EmailReportPreview } from "@/components/landing/email-report-preview";
import { FeatureOrbIcon } from "@/components/landing/feature-orb-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const featureGroups = [
  {
    kind: "scanning",
    title: "Automated Scanning",
    body: "Weekly scans run automatically. No logging in, no manual triggers. Just results in your inbox."
  },
  {
    kind: "pdf",
    title: "White-Label PDF Reports",
    body: "Send clients professional reports with YOUR logo and branding. They'll think you built it yourself."
  },
  {
    kind: "accessibility",
    title: "Accessibility Monitoring",
    body: "The only monitoring tool that checks WCAG accessibility compliance — increasingly required by law."
  },
  {
    kind: "alerts",
    title: "Instant Alerts",
    body: "Score drops by 10 points? Site goes below 50? You get an email immediately — before your client notices."
  },
  {
    kind: "trends",
    title: "Score Trend Graphs",
    body: "See exactly how scores change over time. Prove your work is making a difference."
  },
  {
    kind: "seo",
    title: "Mobile vs Desktop",
    body: "Separate scores for mobile and desktop — because Google cares about both."
  }
] as const;

export default function FeaturesPage() {
  return <AgencyFeaturesPage />;
}
