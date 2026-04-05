import { AgencyPricingPage } from "@/components/landing/agency-pricing-page";
import Link from "next/link";

import { PricingGrid } from "@/components/landing/pricing-grid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { siteCopy } from "@/lib/copy";

export default function PricingPage() {
  return <AgencyPricingPage />;

  return (
    <main className="container py-20">
      <div className="mx-auto max-w-3xl text-center">
        <Badge>3x cheaper than Semrush for agency monitoring</Badge>
        <h1 className="mt-6 font-display text-5xl font-semibold">{siteCopy.tagline}</h1>
        <p className="mt-6 text-lg text-muted-foreground">
          Simple pricing for freelancers, growing agencies, and reseller-style maintenance businesses.
        </p>
      </div>

      <div className="mt-14">
        <PricingGrid />
      </div>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        All plans include 14-day free trial. Cancel anytime. No contracts.
      </p>

      <div className="mt-16 grid gap-6 lg:grid-cols-3">
        {[
          "Automated weekly PDF reports instead of manual exports",
          "White-label branding for professional client delivery",
          "Accessibility scanning built in, without extra tools"
        ].map((item) => (
          <Card key={item}>
            <CardContent className="p-6 text-sm text-muted-foreground">{item}</CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-16 text-center">
        <Button asChild size="lg">
          <Link href="/signup">Start Free — No Credit Card</Link>
        </Button>
      </div>
    </main>
  );
}
