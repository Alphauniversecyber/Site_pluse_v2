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
      <div className="rounded-[1.8rem] border border-white/10 bg-white/[0.05] p-6 shadow-[0_24px_64px_-36px_rgba(15,23,42,0.72)] backdrop-blur-xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.08] text-white">
            <Icon className="h-6 w-6" />
          </div>
          <span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-sky-200">
            {copy.short}
          </span>
        </div>

        <div className="mt-6 space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
            {copy.title}
          </p>
          <h3 className="font-display text-2xl font-semibold text-white">What you&apos;ll unlock</h3>
          <div className="space-y-3 text-sm text-slate-300">
            {copy.bullets.map((bullet) => (
              <div key={bullet} className="flex items-start gap-3">
                <span className="mt-1 h-2 w-2 rounded-full bg-sky-300" />
                <span>{bullet}</span>
              </div>
            ))}
          </div>
          <div className="flex items-start gap-3 rounded-2xl border border-emerald-400/15 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <span>This is read-only. We never modify your data.</span>
          </div>
        </div>

        <Button
          onClick={() => setOpen(true)}
          className="mt-6 h-12 w-full rounded-2xl bg-sky-500 text-white shadow-[0_20px_50px_-28px_rgba(56,189,248,0.85)] hover:bg-sky-400"
        >
          Connect {copy.title}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-white/10 bg-[#0F172A] text-white">
          <DialogHeader>
            <DialogTitle>Connect {copy.title}</DialogTitle>
            <DialogDescription className="text-slate-400">
              You&apos;ll be redirected to Google to approve read-only access for this dashboard.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-300">
            SitePulse only requests analytics visibility so this client dashboard can stay live without a login.
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]">
              Cancel
            </Button>
            <Button
              onClick={() => {
                window.location.assign(`${copy.href}?token=${encodeURIComponent(token)}`);
              }}
              className="bg-sky-500 text-white hover:bg-sky-400"
            >
              Continue to Google
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
