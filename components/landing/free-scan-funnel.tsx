"use client";

import Link from "next/link";
import type { Route } from "next";
import { ArrowRight, Gauge, Lock, Search, Sparkles, WandSparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchJson } from "@/lib/api-client";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import type { PreviewScanResult } from "@/types";
import { useUser } from "@/hooks/useUser";

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
    <div className="flex min-h-[6.25rem] flex-col justify-between rounded-2xl border border-slate-200 bg-white/90 px-3.5 py-3.5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none">
      <p className="text-[0.62rem] font-semibold uppercase leading-4 tracking-[0.13em] text-slate-500 dark:text-slate-400">{label}</p>
      <p className="font-display text-[1.65rem] font-semibold leading-none text-slate-950 dark:text-white">{value}</p>
    </div>
  );
}

export function FreeScanFunnel({ className }: { className?: string }) {
  const router = useRouter();
  const { user } = useUser();
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState<PreviewScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [activeStage, setActiveStage] = useState(0);
  const isAuthenticated = Boolean(user);

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
      if (isAuthenticated) {
        const supabase = createSupabaseBrowserClient();
        const {
          data: { session }
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          throw new Error("Your session expired. Refresh the page and try again.");
        }

        const response = await fetch("/api/scans", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ url })
        });

        const payload = (await response.json().catch(() => ({}))) as {
          data?: { scanId: string };
          error?: string;
        };

        if (!response.ok || !payload.data?.scanId) {
          throw new Error(payload.error ?? "Unable to save the scan to your account right now.");
        }

        router.push(`/dashboard/scans/${payload.data.scanId}` as Route);
        router.refresh();
        return;
      }

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
        "relative overflow-hidden rounded-[2rem] border border-slate-200/90 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.12),transparent_36%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96))] p-5 text-slate-950 shadow-[0_28px_80px_-42px_rgba(15,23,42,0.16)] dark:border-white/10 dark:bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.26),transparent_36%),linear-gradient(180deg,#101935,#081122)] dark:text-white dark:shadow-[0_28px_80px_-42px_rgba(15,23,42,0.75)] sm:p-6 xl:p-7",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-300/70 to-transparent" />
      <div className="pointer-events-none absolute right-0 top-0 h-28 w-40 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.14),transparent_72%)] blur-2xl dark:bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.18),transparent_72%)]" />

      <div className="relative">
        <div className="flex flex-wrap items-center gap-3">
          <Badge className="border-blue-300/30 bg-blue-500/10 text-blue-700 dark:border-blue-300/20 dark:bg-blue-500/12 dark:text-blue-100">
            {isAuthenticated ? "Saved scan" : "Free scan preview"}
          </Badge>
          <p
            className={cn(
              "text-xs uppercase tracking-[0.22em] text-slate-500 dark:text-slate-300",
              isAuthenticated && "hidden"
            )}
          >
            No signup required • Results in 30 seconds
          </p>
        </div>

        {isAuthenticated ? (
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500 dark:text-slate-300">
            Scan saved to your account • Results in 30 seconds
          </p>
        ) : null}

        <form className="mt-5 space-y-4" onSubmit={runPreviewScan}>
          <div className="rounded-[1.6rem] border border-slate-200 bg-white/80 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] dark:border-white/10 dark:bg-white/[0.05] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <div className="flex flex-col gap-2.5 lg:flex-row">
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
                className="h-14 shrink-0 rounded-2xl bg-blue-500 px-5 text-sm font-semibold text-white shadow-[0_22px_50px_-28px_rgba(59,130,246,0.9)] hover:bg-blue-600 sm:text-base lg:min-w-[13rem]"
                disabled={isScanning}
              >
                {isScanning
                  ? isAuthenticated
                    ? "Saving scan..."
                    : "Scanning..."
                  : isAuthenticated
                    ? "Save scan to dashboard"
                    : "Scan a website (free)"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {error ? <p className="text-sm text-rose-600 dark:text-rose-300">{error}</p> : null}
        </form>

        {!preview && !isScanning ? (
          <div className="mt-5 rounded-[1.5rem] border border-blue-200 bg-blue-50/80 p-4 dark:border-blue-400/16 dark:bg-blue-500/[0.06]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-700 dark:text-blue-200">Value demo</p>
            <p className="mt-2 max-w-[32rem] text-sm leading-6 text-slate-700 dark:text-slate-200">
              Your website is losing visitors because pages take 9.6s to load. Fixing 3 issues could improve performance by up to 30%.
            </p>
          </div>
        ) : null}

        {isScanning ? (
          <div className="mt-6 rounded-[1.7rem] border border-slate-200 bg-white/88 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-blue-300/30 bg-blue-500/10 text-blue-600 dark:border-blue-300/20 dark:bg-blue-500/12 dark:text-blue-200">
                <WandSparkles className="h-5 w-5 animate-pulse" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-950 dark:text-white">
                  {isAuthenticated
                    ? "Saving your account scan"
                    : "Running your free client-closing scan"}
                </p>
                <p className="mt-1 text-sm text-slate-400">We're building a near-full preview you can show before signup.</p>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {scanStages.map((stage, index) => (
                <div
                  key={stage}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition duration-200",
                    activeStage === index
                      ? "border-blue-300/30 bg-blue-500/10 text-blue-700 dark:border-blue-300/20 dark:bg-blue-500/10 dark:text-blue-100"
                      : "border-slate-200 bg-slate-50 text-slate-500 dark:border-white/8 dark:bg-white/[0.03] dark:text-slate-400"
                  )}
                >
                  <span
                    className={cn(
                      "h-2.5 w-2.5 rounded-full",
                      activeStage === index ? "bg-blue-500 dark:bg-blue-300" : "bg-slate-300 dark:bg-slate-600"
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
            <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_18.5rem] 2xl:items-start">
              <div className="rounded-[1.7rem] border border-slate-200 bg-white/88 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none sm:p-6">
                <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-700 dark:text-blue-200">
                      Partial result
                    </p>
                    <h3 className="mt-3 font-display text-[clamp(1.9rem,3vw,2.4rem)] font-semibold leading-tight tracking-tight text-slate-950 dark:text-white">
                      {preview.website_label}
                    </h3>
                    <p className="mt-2 break-all text-sm text-slate-500 dark:text-slate-400">{preview.normalized_url}</p>
                  </div>
                  <div className="w-full rounded-[1.5rem] border border-slate-200 bg-slate-50/90 px-5 py-4 text-center dark:border-white/10 dark:bg-white/[0.05] sm:w-auto sm:min-w-[8.5rem]">
                    <p className="text-[0.62rem] font-semibold uppercase leading-4 tracking-[0.13em] text-slate-500 dark:text-slate-400">
                      Overall score
                    </p>
                    <p className="mt-2 font-display text-[3rem] font-semibold leading-none text-slate-950 dark:text-white">
                      {preview.overall_score}
                    </p>
                  </div>
                </div>

                <p className="mt-5 text-base leading-7 text-slate-800 dark:text-slate-100">{preview.impact_message}</p>
                <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{preview.improvement_message}</p>

                <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
                  <ScoreChip label="Performance" value={preview.scores.performance} />
                  <ScoreChip label="SEO" value={preview.scores.seo} />
                  <ScoreChip label="Accessibility" value={preview.scores.accessibility} />
                  <ScoreChip label="Best practice" value={preview.scores.best_practices} />
                </div>
              </div>

              <div className="rounded-[1.7rem] border border-blue-200 bg-[linear-gradient(180deg,rgba(59,130,246,0.08),rgba(255,255,255,0.9))] p-5 shadow-[0_18px_48px_-34px_rgba(59,130,246,0.25)] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(59,130,246,0.12),rgba(255,255,255,0.04))] dark:shadow-none sm:p-6">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-blue-300/30 bg-blue-500/10 text-blue-600 dark:border-blue-300/20 dark:bg-blue-500/12 dark:text-blue-100">
                    <Lock className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-950 dark:text-white">Unlock the full report</p>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                      Get the full issue breakdown, business impact story, and client-ready follow-up instantly.
                    </p>
                  </div>
                </div>

                <div className="mt-5 rounded-[1.4rem] border border-slate-200 bg-white/80 p-4 dark:border-white/10 dark:bg-slate-950/25">
                  <div className="flex items-start gap-3">
                    <Gauge className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-200" />
                    <p className="text-sm text-slate-700 dark:text-slate-200">Full report includes the complete issue list, growth-focused explanations, and the white-label delivery workflow.</p>
                  </div>
                </div>

                <div className="mt-5 flex flex-col gap-3">
                  <Button asChild className="h-12 rounded-2xl bg-blue-500 px-4 text-sm font-semibold hover:bg-blue-600 sm:text-base">
                    <Link href={unlockHref}>
                      Unlock full report
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="h-auto min-h-12 whitespace-normal rounded-2xl border-slate-300 bg-white px-4 py-3 text-center text-sm leading-5 text-slate-950 hover:bg-slate-100 dark:border-white/15 dark:bg-white/[0.02] dark:text-white dark:hover:bg-white/[0.06]">
                    <Link href={buildAuthHref("/login", preview.unlock_path)}>Already have an account? Log in</Link>
                  </Button>
                </div>
              </div>
            </div>

            <div className="rounded-[1.7rem] border border-slate-200 bg-white/88 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-700 dark:text-blue-200">
                    What we found first
                  </p>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                    These are the first client-facing issues we would put into a sales follow-up or retention review.
                  </p>
                </div>
                <Badge className="border-slate-200 bg-slate-50 text-slate-700 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-200">
                  Near-full report preview
                </Badge>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {preview.issues.map((issue) => (
                  <div key={issue.id} className="rounded-[1.45rem] border border-slate-200 bg-slate-50/80 p-4 dark:border-white/8 dark:bg-slate-950/25">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-200" />
                      <p className="text-sm font-semibold text-slate-950 dark:text-white">{issue.title}</p>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-700 dark:text-slate-200">{issue.summary}</p>
                    <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">{issue.why_it_matters}</p>
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

