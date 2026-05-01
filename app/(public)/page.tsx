import { AgencyGrowthHome } from "@/components/landing/agency-growth-home";
import { getBillingPlans } from "@/lib/billing-config";

export default async function LandingPage() {
  const plans = await getBillingPlans();

  return <AgencyGrowthHome plans={plans} />;
}
