import type { Metadata } from "next";
import Link from "next/link";

import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-json-ld";

export const metadata: Metadata = {
  title: "SitePulse Blog",
  description:
    "Read SitePulse insights on SEO audits, agency reporting, client retention, and turning website issues into growth opportunities.",
  alternates: {
    canonical: "https://www.trysitepulse.com/blog"
  }
};

const featuredTopics = [
  {
    title: "SEO audit strategy for agencies",
    description:
      "How to turn technical findings into a client-facing narrative that supports proposals and monthly retainers."
  },
  {
    title: "Reporting that proves business impact",
    description:
      "Ways to connect SEO, trust, accessibility, and performance issues to revenue risk and account health."
  },
  {
    title: "Retention workflows that stay proactive",
    description:
      "Why ongoing monitoring, scheduled reports, and clear next actions help agencies defend client relationships."
  }
] as const;

export default function BlogPage() {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", item: "https://www.trysitepulse.com" },
          { name: "Blog", item: "https://www.trysitepulse.com/blog" }
        ]}
      />
      <main className="container py-14 md:py-20">
        <div className="mx-auto max-w-4xl">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
            Blog
          </p>
          <h1 className="mt-6 font-display text-4xl font-semibold tracking-tight md:text-5xl">
            SitePulse Blog
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">
            We use the blog to share practical guidance for agencies that want better audit workflows,
            stronger reporting, and more convincing proof of value for clients.
          </p>

          <div className="mt-10 grid gap-6">
            {featuredTopics.map((topic) => (
              <article key={topic.title} className="rounded-[2rem] border border-border/80 bg-card/60 p-6">
                <h2 className="font-display text-2xl font-semibold tracking-tight">{topic.title}</h2>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">{topic.description}</p>
              </article>
            ))}
          </div>

          <p className="mt-10 text-sm leading-7 text-muted-foreground">
            While we publish more articles, you can explore the latest product updates in the{" "}
            <Link href="/changelog" className="font-medium text-primary transition-colors hover:text-foreground">
              changelog
            </Link>{" "}
            or see what is coming next on the{" "}
            <Link href="/roadmap" className="font-medium text-primary transition-colors hover:text-foreground">
              roadmap
            </Link>
            .
          </p>
        </div>
      </main>
    </>
  );
}
