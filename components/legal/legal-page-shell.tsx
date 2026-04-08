import Link from "next/link";
import type { Route } from "next";

import { Badge } from "@/components/ui/badge";

interface LegalSection {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
}

export function LegalPageShell({
  eyebrow,
  title,
  intro,
  lastUpdated,
  sections
}: {
  eyebrow: string;
  title: string;
  intro: string;
  lastUpdated: string;
  sections: LegalSection[];
}) {
  return (
    <main className="container py-14 md:py-20">
      <div className="mx-auto max-w-4xl">
        <Badge>{eyebrow}</Badge>
        <h1 className="mt-6 font-display text-4xl font-semibold tracking-tight md:text-5xl">
          {title}
        </h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">{intro}</p>
        <p className="mt-4 text-sm text-muted-foreground">Last updated: {lastUpdated}</p>

        <div className="mt-10 rounded-[2rem] border border-border/80 bg-card/80 p-6 shadow-[0_24px_70px_-50px_rgba(15,23,42,0.3)] md:p-8">
          <div className="space-y-10">
            {sections.map((section) => (
              <section key={section.title} className="space-y-4">
                <h2 className="font-display text-2xl font-semibold">{section.title}</h2>
                {section.paragraphs?.map((paragraph) => (
                  <p key={paragraph} className="text-sm leading-7 text-muted-foreground md:text-base">
                    {paragraph}
                  </p>
                ))}
                {section.bullets ? (
                  <ul className="space-y-3 text-sm leading-7 text-muted-foreground md:text-base">
                    {section.bullets.map((bullet) => (
                      <li key={bullet} className="flex gap-3">
                        <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary" />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-4 text-sm text-muted-foreground">
          <Link href={"/terms" as Route} className="premium-link">
            Terms of Service
          </Link>
          <Link href={"/privacy" as Route} className="premium-link">
            Privacy Policy
          </Link>
          <Link href={"/refund" as Route} className="premium-link">
            Refund Policy
          </Link>
        </div>
      </div>
    </main>
  );
}
