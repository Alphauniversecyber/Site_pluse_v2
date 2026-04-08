import Link from "next/link";

import { PricingGrid } from "@/components/landing/pricing-grid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { marketingCopy } from "@/lib/marketing-copy";

const pricingProof = [
  "Close 1 client = $500+ in monthly revenue for many agencies.",
  "SitePulse Growth = $49/month.",
  "Retention proof can save a shaky account before it churns."
] as const;

export function AgencyPricingPage() {
  return (
    <main className="container py-16 md:py-20">
      <div className="mx-auto max-w-4xl text-center">
        <Badge>ROI-first pricing</Badge>
        <h1 className="mt-6 font-display text-5xl font-semibold">{marketingCopy.tagline}</h1>
        <p className="mt-6 text-lg leading-8 text-muted-foreground">
          Price SitePulse like a revenue tool, not a software expense. Every plan is framed around how agencies test value, grow retainers, and scale operations.
        </p>
      </div>

      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {pricingProof.map((item) => (
          <Card key={item} className="theme-panel border-border/80">
            <CardContent className="p-5 text-sm leading-7 text-muted-foreground">{item}</CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-10">
        <PricingGrid showToggle />
      </div>

      <div className="mt-14 grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <Card className="theme-panel border-border/80">
          <CardContent className="p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">Value comparison</p>
            <h2 className="mt-4 font-display text-3xl font-semibold">The cheapest win is usually the one you can prove fast.</h2>
            <p className="mt-4 text-sm leading-7 text-muted-foreground">
              Agencies rarely lose work because they care too much about websites. They lose work when clients do not clearly see what the agency is protecting, improving, or preventing. SitePulse helps you make that value visible every week.
            </p>
          </CardContent>
        </Card>

        <Card className="theme-panel border-primary/15 bg-primary/[0.06]">
          <CardContent className="p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">Simple decision</p>
            <p className="mt-4 font-display text-3xl font-semibold">Close one extra client and this pays for itself.</p>
            <p className="mt-4 text-sm leading-7 text-muted-foreground">
              Use the free scan preview to start the conversation, Growth to standardize delivery, and Pro when you want the whole workflow to feel like your agency&apos;s own premium system.
            </p>
            <Button asChild className="mt-6">
              <Link href="/#free-scan">Scan a website (free)</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
