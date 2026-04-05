"use client";

import Link from "next/link";
import type { Route } from "next";
import { ArrowRight, Gauge, Lock, Search, Sparkles, WandSparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchJson } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { PreviewScanResult } from "@/types";

const scanStages = [
  "Analyzing performance...",
  "Checking SEO...",
  "Detecting issues..."
] as const;

function buildAuthHref(pathname: "/signup" | "/login", nextPath?: string): Route {
  if (!nextPath) {
    return pathname;
  }

  return `${pathname}?next=${encodeURIComponent(nextPath)}` as Route;
}

function ScoreChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-2 font-display text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

export function FreeScanFunnel({ className }: { className?: string }) {
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState<PreviewScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [activeStage, setActiveStage] = useState(0);

  useEffect(() => {
    if (!isScanning) {
      setActiveStage(0);
      return;
    }

    const interval = window.setInterval(() => {
      setActiveStage((current) => (current + 1) % scanStages.length);
    }, 1400);

    return () => window.clearInterval(interval);
  }, [isScanning]);

  const unlockHref = useMemo(() => {
    if (!preview) {
      return buildAuthHref("/signup");
    }

    return buildAuthHref("/signup", preview.unlock_path);
  }, [preview]);

  async function runPreviewScan(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPreview(null);
    setIsScanning(true);

    try {
      const result = await fetchJson<PreviewScanResult>("/api/preview-scan", {
        method: "POST",
        body: JSON.stringify({ url })
      });

      setPreview(result);
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : "Unable to run the free scan right now.");
    } finally {
      setIsScanning(false);
    }
  }

  return (
    <div
      id="free-scan"
      className={cn(
        "relative overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.26),transparent_36%),linear-gradient(180deg,#101935,#081122)] p-5 text-white shadow-[0_28px_80px_-42px_rgba(15,23,42,0.75)] sm:p-6 xl:p-7",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-300/70 to-transparent" />
      <div className="pointer-events-none absolute right-0 top-0 h-28 w-40 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.18),transparent_72%)] blur-2xl" />

      <div className="relative">
        <div className="flex flex-wrap items-center gap-3">
          <Badge className="border-blue-300/20 bg-blue-500/12 text-blue-100">Free scan preview</Badge>
          <p className="text-xs uppercase tracking-[0.22em] text-slate-300">
            No signup required • Results in 30 seconds
          </p>
        </div>

        <form className="mt-5 space-y-4" onSubmit={runPreviewScan}>
          <div className="rounded-[1.6rem] border border-white/10 bg-white/[0.05] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <div className="flex flex-col gap-2.5 md:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="Enter a client website URL"
                  className="h-14 border-none bg-white/95 pl-11 text-base text-slate-950 shadow-none placeholder:text-slate-500"
                />
              </div>
              <Button
                type="submit"
                className="h-14 rounded-2xl bg-blue-500 px-6 text-base font-semibold text-white shadow-[0_22px_50px_-28px_rgba(59,130,246,0.9)] hover:bg-blue-600"
                disabled={isScanning}
              >
                {isScanning ? "Scanning..." : "Scan a website (free)"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        </form>

        {!preview && !isScanning ? (
          <div className="mt-5 rounded-[1.5rem] border border-blue-400/16 bg-blue-500/[0.06] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-200">Value demo</p>
            <p className="mt-2 text-sm leading-7 text-slate-200">
              Your website is losing visitors due to slow load speed (9.6s). Fixing 3 issues could improve performance by up to 30%.
            </p>
          </div>
        ) : null}

        {isScanning ? (
          <div className="mt-6 rounded-[1.7rem] border border-white/10 bg-white/[0.04] p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-blue-300/20 bg-blue-500/12 text-blue-200">
                <WandSparkles className="h-5 w-5 animate-pulse" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Running your free client-closing scan</p>
                <p className="mt-1 text-sm text-slate-400">We’re building a near-full preview you can show before signup.</p>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {scanStages.map((stage, index) => (
                <div
                  key={stage}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition duration-200",
                    activeStage === index
                      ? "border-blue-300/20 bg-blue-500/10 text-blue-100"
                      : "border-white/8 bg-white/[0.03] text-slate-400"
                  )}
                >
                  <span
                    className={cn(
                      "h-2.5 w-2.5 rounded-full",
                      activeStage === index ? "bg-blue-300" : "bg-slate-600"
                    )}
                  />
                  {stage}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {preview ? (
          <div className="mt-6 space-y-5">
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(280px,0.95fr)]">
              <div className="rounded-[1.7rem] border border-white/10 bg-white/[0.04] p-5">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-200">
                      Partial result
                    </p>
                    <h3 className="mt-3 font-display text-3xl font-semibold tracking-tight">
                      {preview.website_label}
                    </h3>
                    <p className="mt-2 text-sm text-slate-400">{preview.normalized_url}</p>
                  </div>
                  <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.05] px-5 py-4 text-center">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Overall score
                    </p>
                    <p className="mt-2 font-display text-[3.2rem] font-semibold leading-none text-white">
                      {preview.overall_score}
                    </p>
                  </div>
                </div>

                <p className="mt-5 text-base leading-7 text-slate-100">{preview.impact_message}</p>
                <p className="mt-2 text-sm leading-6 text-slate-400">{preview.improvement_message}</p>

                <div className="mt-5 grid gap-3 sm:grid-cols-4">
                  <ScoreChip label="Performance" value={preview.scores.performance} />
                  <ScoreChip label="SEO" value={preview.scores.seo} />
                  <ScoreChip label="Accessibility" value={preview.scores.accessibility} />
                  <ScoreChip label="Best practice" value={preview.scores.best_practices} />
                </div>
              </div>

              <div className="rounded-[1.7rem] border border-white/10 bg-[linear-gradient(180deg,rgba(59,130,246,0.12),rgba(255,255,255,0.04))] p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-blue-300/20 bg-blue-500/12 text-blue-100">
                    <Lock className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Unlock the full report</p>
                    <p className="mt-1 text-sm text-slate-300">
                      Get the full issue breakdown, business impact story, and client-ready follow-up instantly.
                    </p>
                  </div>
                </div>

                <div className="mt-5 rounded-[1.4rem] border border-white/10 bg-slate-950/25 p-4">
                  <div className="flex items-center gap-3">
                    <Gauge className="h-4 w-4 text-blue-200" />
                    <p className="text-sm text-slate-200">Full report includes the complete issue list, growth-focused explanations, and the white-label delivery workflow.</p>
                  </div>
                </div>

                <div className="mt-5 flex flex-col gap-3">
                  <Button asChild className="h-12 rounded-2xl bg-blue-500 text-base font-semibold hover:bg-blue-600">
                    <Link href={unlockHref}>
                      Unlock full report
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="h-12 rounded-2xl border-white/15 bg-white/[0.02] text-white hover:bg-white/[0.06]">
                    <Link href={buildAuthHref("/login", preview.unlock_path)}>Already have an account? Log in</Link>
                  </Button>
                </div>
              </div>
            </div>

            <div className="rounded-[1.7rem] border border-white/10 bg-white/[0.04] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-200">
                    What we found first
                  </p>
                  <p className="mt-2 text-sm text-slate-300">
                    These are the first client-facing issues we would put into a sales follow-up or retention review.
                  </p>
                </div>
                <Badge className="border-white/10 bg-white/[0.05] text-slate-200">
                  Near-full report preview
                </Badge>
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-3">
                {preview.issues.map((issue) => (
                  <div key={issue.id} className="rounded-[1.45rem] border border-white/8 bg-slate-950/25 p-4">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-blue-200" />
                      <p className="text-sm font-semibold text-white">{issue.title}</p>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-200">{issue.summary}</p>
                    <p className="mt-3 text-sm leading-6 text-slate-400">{issue.why_it_matters}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
