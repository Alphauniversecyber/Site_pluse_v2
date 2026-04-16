"use client";

import { useState } from "react";
import { ArrowRight, BarChart3, Search, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";

const CONNECT_COPY = {
  gsc: {
    short: "GSC",
    title: "Google Search Console",
    href: "/api/d/connect/gsc",
    icon: Search,
    bullets: [
      "Daily clicks and impressions",
      "Average search position trends",
      "Top search queries from Google"
    ]
  },
  ga: {
    short: "GA4",
    title: "Google Analytics 4",
    href: "/api/d/connect/ga",
    icon: BarChart3,
    bullets: [
      "Live sessions and bounce rate",
      "Top pages by session volume",
      "Device and country audience mix"
    ]
  }
} as const;

export function ConnectCard({
  service,
  token
}: {
  service: "gsc" | "ga";
  token: string;
}) {
  const [open, setOpen] = useState(false);
  const copy = CONNECT_COPY[service];
  const Icon = copy.icon;

  return (
    <>
      <div className="rounded-[1.8rem] border border-border/70 bg-card/90 p-6 shadow-[0_30px_80px_-48px_rgba(15,23,42,0.38)] backdrop-blur-xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-background/80 text-foreground">
            <Icon className="h-6 w-6" />
          </div>
          <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-sky-600 dark:text-sky-300">
            {copy.short}
          </span>
        </div>

        <div className="mt-6 space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            {copy.title}
          </p>
          <h3 className="font-display text-2xl font-semibold text-foreground">What you&apos;ll unlock</h3>
          <div className="space-y-3 text-sm text-muted-foreground">
            {copy.bullets.map((bullet) => (
              <div key={bullet} className="flex items-start gap-3">
                <span className="mt-1 h-2 w-2 rounded-full bg-sky-300" />
                <span>{bullet}</span>
              </div>
            ))}
          </div>
          <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/15 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-200">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <span>This is read-only. We never modify your data.</span>
          </div>
        </div>

        <Button
          onClick={() => setOpen(true)}
          className="mt-6 h-12 w-full rounded-2xl"
        >
          Connect {copy.title}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-border bg-background text-foreground">
          <DialogHeader>
            <DialogTitle>Connect {copy.title}</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              You&apos;ll be redirected to Google to approve read-only access for this dashboard.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-2xl border border-border bg-card/70 px-4 py-3 text-sm text-muted-foreground">
            SitePulse only requests analytics visibility so this client dashboard can stay live without a login.
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                window.location.assign(`${copy.href}?token=${encodeURIComponent(token)}`);
              }}
            >
              Continue to Google
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
