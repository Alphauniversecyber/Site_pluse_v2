import { ArrowUpRight, Gauge, Sparkles, Waves } from "lucide-react";

import type { GaDashboardData, GscDashboardData } from "@/types";
import { GAChart } from "@/components/client-dashboard/GAChart";
import { GSCChart } from "@/components/client-dashboard/GSCChart";
import { StatCard } from "@/components/client-dashboard/StatCard";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

function sourceVariant(source: "live" | "mock") {
  return source === "live" ? "success" : "secondary";
}

function scoreTone(score: number) {
  if (score > 70) {
    return {
      stroke: "#22C55E"
    };
  }

  if (score >= 40) {
    return {
      stroke: "#EAB308"
    };
  }

  return {
    stroke: "#EF4444"
  };
}

function bounceTone(bounceRate: number) {
  if (bounceRate <= 46) {
    return "text-emerald-300";
  }

  if (bounceRate <= 50) {
    return "text-amber-300";
  }

  return "text-rose-300";
}

export function Overview({
  healthScore,
  statusLabel,
  gsc,
  ga,
  gscLoading,
  gaLoading
}: {
  healthScore: number;
  statusLabel: string;
  gsc: GscDashboardData;
  ga: GaDashboardData;
  gscLoading?: boolean;
  gaLoading?: boolean;
}) {
  const circumference = 2 * Math.PI * 64;
  const progress = circumference - (healthScore / 100) * circumference;
  const tone = scoreTone(healthScore);

  return (
    <div className="space-y-6">
      {gscLoading || gaLoading ? (
        <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.04] px-4 py-3">
          <Skeleton className="h-2 w-20 bg-white/15" />
          <Skeleton className="h-2 w-14 bg-white/15" />
          <span className="text-xs uppercase tracking-[0.18em] text-slate-400">Refreshing live Google data</span>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        <div className="rounded-[1.9rem] border border-white/10 bg-white/[0.05] p-6 shadow-[0_24px_64px_-36px_rgba(15,23,42,0.72)] backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.08] text-white">
              <Gauge className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Health Score</p>
              <p className="text-sm text-slate-400">Overall technical health snapshot</p>
            </div>
          </div>

          <div className="mt-6 flex flex-col items-center justify-center gap-4 text-center sm:flex-row sm:text-left">
            <div className="relative">
              <svg viewBox="0 0 160 160" className="h-40 w-40 -rotate-90">
                <circle
                  cx="80"
                  cy="80"
                  r="64"
                  stroke="rgba(148,163,184,0.18)"
                  strokeWidth="12"
                  fill="none"
                />
                <circle
                  cx="80"
                  cy="80"
                  r="64"
                  stroke={tone.stroke}
                  strokeWidth="12"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={progress}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-display text-4xl font-semibold text-white">{healthScore}</span>
                <span className="text-xs uppercase tracking-[0.18em] text-slate-400">Out of 100</span>
              </div>
            </div>
            <div className="space-y-3">
              <p className="font-display text-3xl font-semibold text-white">{statusLabel}</p>
              <p className="max-w-xs text-sm leading-6 text-slate-300">
                This score blends your latest technical scan with live and mock search-health signals.
              </p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Indexed Pages</p>
              <p className="mt-2 text-2xl font-semibold text-white">{gsc.summary.indexedPages.toLocaleString()}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Sitemap Health</p>
              <p className="mt-2 text-2xl font-semibold text-white">{gsc.summary.sitemapSubmitted.toLocaleString()}</p>
              <p className="text-xs text-slate-500">submitted</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">GSC Source</p>
              <div className="mt-2">
                <Badge variant={sourceVariant(gsc.source)}>{gsc.source}</Badge>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">GA4 Source</p>
              <div className="mt-2">
                <Badge variant={sourceVariant(ga.source)}>{ga.source}</Badge>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <StatCard
            label="Clicks"
            value={gsc.summary.clicks.toLocaleString()}
            subtext="Last 28 days"
            change={gsc.comparison.clicks}
          />
          <StatCard
            label="Impressions"
            value={gsc.summary.impressions.toLocaleString()}
            subtext="Last 28 days"
            change={gsc.comparison.impressions}
          />
          <StatCard
            label="Avg Position"
            value={gsc.summary.avgPosition.toFixed(1)}
            subtext="Lower is better"
            change={gsc.comparison.avgPosition}
          />
          <StatCard
            label="Indexed Pages"
            value={gsc.summary.indexedPages.toLocaleString()}
            subtext="Estimated from sitemap coverage"
            change={gsc.comparison.indexedPages}
          />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <GSCChart data={gsc.daily} variant="traffic" loading={gscLoading} />
        <GSCChart data={gsc.daily} variant="position" loading={gscLoading} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-[1.8rem] border border-white/10 bg-white/[0.05] p-5 shadow-[0_24px_64px_-36px_rgba(15,23,42,0.72)] backdrop-blur-xl">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Sessions</p>
              <div className="flex items-end gap-3">
                <p className="font-display text-4xl font-semibold text-white">{ga.summary.sessions.toLocaleString()}</p>
                <div className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300">
                  <ArrowUpRight className="h-4 w-4" />
                  {`${ga.comparison.sessions > 0 ? "+" : ""}${ga.comparison.sessions.toFixed(1)}%`}
                </div>
              </div>
            </div>
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.08] text-white">
              <Sparkles className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-4">
            <GAChart variant="sessions" daily={ga.daily} loading={gaLoading && ga.source === "mock"} />
          </div>
          {!ga.connected ? (
            <div className="mt-4 rounded-2xl border border-sky-400/15 bg-sky-400/10 px-4 py-3 text-sm text-sky-100">
              Connect GA4 to unlock session data. Mock values are shown until a live source is connected.
            </div>
          ) : null}
        </div>

        <div className="rounded-[1.8rem] border border-white/10 bg-white/[0.05] p-5 shadow-[0_24px_64px_-36px_rgba(15,23,42,0.72)] backdrop-blur-xl">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Bounce Rate</p>
              <p className={`font-display text-4xl font-semibold ${bounceTone(ga.summary.bounceRate)}`}>
                {ga.summary.bounceRate.toFixed(1)}%
              </p>
              <p className="text-sm text-slate-400">Lower rates usually signal stronger landing-page engagement.</p>
            </div>
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.08] text-white">
              <Waves className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Source</p>
              <div className="mt-2">
                <Badge variant={sourceVariant(ga.source)}>{ga.source}</Badge>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Trend</p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {`${ga.comparison.bounceRate > 0 ? "+" : ""}${ga.comparison.bounceRate.toFixed(1)}%`}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
