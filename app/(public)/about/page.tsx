import type { Metadata } from "next";

import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-json-ld";

export const metadata: Metadata = {
  title: "About SitePulse — SEO Audit Tool for Agencies",
  description:
    "SitePulse helps digital agencies turn website audits into paying clients with automated white-label SEO reports.",
  alternates: {
    canonical: "https://www.trysitepulse.com/about"
  }
};

export default function AboutPage() {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", item: "https://www.trysitepulse.com" },
          { name: "About", item: "https://www.trysitepulse.com/about" }
        ]}
      />
      <main className="container py-14 md:py-20">
        <div className="mx-auto max-w-4xl">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
            About
          </p>
          <h1 className="mt-6 font-display text-4xl font-semibold tracking-tight md:text-5xl">
            About SitePulse
          </h1>
          <div className="mt-6 space-y-5 text-base leading-8 text-muted-foreground md:text-lg">
            <p>
              SitePulse is built for digital agencies that need a faster way to audit websites, explain issues clearly, and turn technical work into visible client value. Instead of handing over confusing exports or generic dashboards, teams can generate polished SEO reports that support sales, renewals, and ongoing account management.
            </p>
            <p>
              The platform combines automated scanning, white-label reporting, and business-focused issue framing so agencies can show what changed, why it matters, and what should happen next. That makes SitePulse useful both before a prospect signs and after a client is already on retainer.
            </p>
            <p>
              Our goal is simple: help agencies spend less time formatting audit findings and more time using those insights to win trust, protect revenue, and grow stronger recurring relationships with clients.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
