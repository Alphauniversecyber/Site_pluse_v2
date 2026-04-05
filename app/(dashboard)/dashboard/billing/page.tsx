"use client";

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchJson } from "@/lib/api-client";
import { useUser } from "@/hooks/useUser";
import { getPlanDisplayName } from "@/lib/utils";

export default function BillingPage() {
  const { user, loading } = useUser();

  async function startCheckout(plan: "starter" | "agency") {
    try {
      const data = await fetchJson<{ url: string }>("/api/stripe/checkout", {
        method: "POST",
        body: JSON.stringify({ plan })
      });
      window.location.href = data.url;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to open checkout.");
    }
  }

  async function openBillingPortal() {
    try {
      const data = await fetchJson<{ url: string }>("/api/stripe/portal", {
        method: "POST"
      });
      window.location.href = data.url;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to open billing portal.");
    }
  }

  if (loading || !user) {
    return <p className="text-muted-foreground">Loading billing...</p>;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Billing"
        title="Plans built around agency ROI"
        description="Upgrade when you want more client coverage, stronger delivery workflows, and higher perceived value. Use Stripe for invoices, plan changes, and cancellation."
      />

      <Card>
        <CardHeader>
          <CardTitle>Current subscription</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Badge variant={user.plan === "agency" ? "success" : user.plan === "starter" ? "default" : "outline"}>
              {getPlanDisplayName(user.plan)} plan
            </Badge>
            <p className="mt-4 text-muted-foreground">
              {user.plan === "free"
                ? "You are currently on the Starter plan."
                : "Manage billing history, cancellation, and payment methods through Stripe."}
            </p>
          </div>
          {user.plan !== "free" ? (
            <Button onClick={openBillingPortal}>Open billing portal</Button>
          ) : (
            <Button asChild>
              <Link href="/pricing">View pricing</Link>
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {[
          {
            title: "Growth",
            price: "$49/mo",
            plan: "starter" as const,
            features: ["5 websites", "Daily scans", "90 day history", "PDF report downloads", "Weekly email reports", "Email notifications"]
          },
          {
            title: "Pro",
            price: "$149/mo",
            plan: "agency" as const,
            features: ["30 websites", "White-label reports", "Daily email reports", "Priority alerts", "Team access (3 users)", "CSV export"]
          }
        ].map((plan) => (
          <Card key={plan.title}>
            <CardHeader>
              <CardTitle>{plan.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-display text-4xl font-semibold">{plan.price}</p>
              <div className="mt-6 space-y-3">
                {plan.features.map((feature) => (
                  <div key={feature} className="flex items-center gap-3 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    {feature}
                  </div>
                ))}
              </div>
              <Button className="mt-8 w-full" variant={user.plan === plan.plan ? "outline" : "default"} onClick={() => startCheckout(plan.plan)}>
                {user.plan === plan.plan ? "Renew / update in Stripe" : `Choose ${plan.title}`}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
