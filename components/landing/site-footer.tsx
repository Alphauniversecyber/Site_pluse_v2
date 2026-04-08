"use client";

import Link from "next/link";
import type { Route } from "next";
import { Linkedin, Twitter } from "lucide-react";

import { SitePulseLogo } from "@/components/brand/sitepulse-logo";
import { useUser } from "@/hooks/useUser";
import { cn } from "@/lib/utils";

const productLinks: Array<{ href: string; label: string }> = [
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/changelog", label: "Changelog" },
  { href: "/roadmap", label: "Roadmap" }
];

const companyLinks: Array<{ href: string; label: string }> = [
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/refund", label: "Refunds" },
  { href: "/contact", label: "Contact" }
];

const socialLinks = [
  { href: "https://www.linkedin.com/company/sitepulse", label: "LinkedIn", icon: Linkedin },
  { href: "https://x.com/trysitepulse", label: "Twitter", icon: Twitter }
] as const;

function footerLabel(label: string) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/80">
      {label}
    </p>
  );
}

export function SiteFooter({ className }: { className?: string }) {
  const { user, loading } = useUser();
  const isAuthenticated = !loading && Boolean(user);
  const authLink = isAuthenticated
    ? ({ href: "/dashboard", label: "Dashboard" } as const)
    : ({ href: "/login", label: "Login / Sign up" } as const);

  return (
    <footer
      className={cn(
        "bg-background/90 transition-colors duration-300",
        className
      )}
    >
      <div className="border-t border-slate-200/80 dark:border-white/[0.08]">
        <div className="container py-12 md:py-14">
          <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <SitePulseLogo variant="light" className="h-10 w-[170px] max-w-full dark:hidden" />
              <SitePulseLogo variant="dark" className="hidden h-10 w-[170px] max-w-full dark:inline-flex" />
              <p className="mt-4 max-w-[220px] text-[13px] leading-6 text-muted-foreground/80">
                SitePulse helps agencies turn audits into client-ready proof, revenue-focused reporting, and stronger retention.
              </p>
              <div className="mt-5 flex items-center gap-3">
                {socialLinks.map(({ href, label, icon: Icon }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={label}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/80 text-muted-foreground/80 transition-colors duration-150 ease-out hover:text-primary"
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              {footerLabel("Product")}
              <div className="space-y-3">
                {productLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href as Route}
                    className="block text-[14px] font-normal text-muted-foreground/80 transition-colors duration-150 ease-out hover:text-primary"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              {footerLabel("Company")}
              <div className="space-y-3">
                <Link
                  href={authLink.href as Route}
                  className="block text-[14px] font-normal text-muted-foreground/80 transition-colors duration-150 ease-out hover:text-primary"
                >
                  {authLink.label}
                </Link>
                {companyLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href as Route}
                    className="block text-[14px] font-normal text-muted-foreground/80 transition-colors duration-150 ease-out hover:text-primary"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              {footerLabel("Trust")}
              <div className="space-y-3 text-[14px] leading-7 text-muted-foreground/80">
                <p>Built for agencies that want to close faster, retain longer, and look premium doing it.</p>
                <p>Not a developer dashboard. A premium client acquisition and retention system with proof clients can actually understand.</p>
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-3 border-t border-slate-200/80 pt-5 text-[13px] text-muted-foreground/75 sm:flex-row sm:items-center sm:justify-center dark:border-white/[0.08]">
            <p>© 2025 SitePulse. All rights reserved.</p>
            <span className="hidden text-muted-foreground/50 sm:inline">|</span>
            <p>Made for agencies, not developers.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
