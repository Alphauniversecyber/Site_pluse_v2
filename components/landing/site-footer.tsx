import Link from "next/link";

import { SitePulseLogo } from "@/components/brand/sitepulse-logo";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-background/80 transition-colors duration-300">
      <div className="container grid gap-8 py-12 md:grid-cols-3">
        <div>
          <SitePulseLogo variant="light" className="h-10 w-[170px] max-w-full dark:hidden" />
          <SitePulseLogo variant="dark" className="hidden h-10 w-[170px] max-w-full dark:inline-flex" />
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">
            SitePulse helps agencies turn audits into client-ready proof, revenue-focused reporting, and stronger retention.
          </p>
        </div>
        <div className="space-y-3 text-sm text-muted-foreground">
          <Link href="/features" className="premium-link block">
            Features
          </Link>
          <Link href="/pricing" className="premium-link block">
            Pricing
          </Link>
          <Link href="/login" className="premium-link block">
            Login
          </Link>
        </div>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>Built for agencies that want to close faster, retain longer, and look premium doing it.</p>
          <p>Not a developer dashboard. A premium client acquisition and retention system with proof clients can actually understand.</p>
        </div>
      </div>
    </footer>
  );
}
