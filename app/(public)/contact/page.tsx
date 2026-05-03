import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Contact SitePulse",
  description:
    "Contact SitePulse for sales, partnerships, support, privacy requests, and questions about our SEO audit and reporting platform for agencies.",
  alternates: {
    canonical: "https://www.trysitepulse.com/contact"
  }
};

const contactCards = [
  {
    title: "Sales and partnerships",
    detail:
      "Talk through agency fit, rollout plans, and how to position SitePulse in your service stack.",
    href: "mailto:support@trysitepulse.com",
    label: "support@trysitepulse.com"
  },
  {
    title: "Privacy and data requests",
    detail: "Use this address for account data access, deletion requests, or privacy-related questions.",
    href: "mailto:privacy@trysitepulse.com",
    label: "privacy@trysitepulse.com"
  }
] as const;

export default function ContactPage() {
  return (
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

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {contactCards.map((card) => (
            <Card key={card.title} className="border-border/80">
              <CardHeader>
                <CardTitle>{card.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm leading-7 text-muted-foreground">{card.detail}</p>
                <a
                  href={card.href}
                  className="text-sm font-medium text-primary transition-colors duration-150 ease-out hover:text-foreground"
                >
                  {card.label}
                </a>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </main>
  );
}
