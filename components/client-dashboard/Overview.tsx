"use client";

import { ArrowUpRight, Gauge, Sparkles, Waves } from "lucide-react";

import type { ClientDashboardPayload, DashboardDataSource, GaDashboardData, GscDashboardData } from "@/types";
import { GAChart } from "@/components/client-dashboard/GAChart";
import { GSCChart } from "@/components/client-dashboard/GSCChart";
import { StatCard } from "@/components/client-dashboard/StatCard";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

function sourceVariant(source: DashboardDataSource): "success" | "warning" | "outline" {
  if (source === "live") {
    return "success";
  }

  if (source === "unavailable") {
    return "warning";
  }

  return "outline";
}

function sourceLabel(source: DashboardDataSource) {
  if (source === "live") {
    return "Live";
  }

  if (source === "unavailable") {
    return "Waiting";
  }

  return "Disconnected";
}

function reviewStatusVariant(score: number | null): "success" | "warning" | "outline" {
  if (score === null) {
    return "outline";
  }

  return score > 70 ? "success" : "warning";
}

function scoreTone(score: number | null) {
  if (score === null) {
    return {
      stroke: "#94A3B8"
    };
  }

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
    return "text-emerald-600 dark:text-emerald-300";
  }

  if (bounceRate <= 50) {
    return "text-amber-600 dark:text-amber-300";
  }

  return "text-rose-600 dark:text-rose-300";
}

function formatVitalValue(
  value: number | null,
  kind: "seconds" | "milliseconds" | "milliseconds_as_seconds" | "score" | "shift"
) {
  if (value === null || Number.isNaN(value)) {
    return "—";
  }

  if (kind === "milliseconds") {
    return `${Math.round(value)} ms`;
  }

  if (kind === "milliseconds_as_seconds") {
    return `${(value / 1000).toFixed(1)}s`;
  }

  if (kind === "shift") {
    return value.toFixed(2);
  }

  if (kind === "score") {
    return `${Math.round(value)}`;
  }

  return `${(value > 100 ? value / 1000 : value).toFixed(1)} s`;
}

function metricStatus(connected: boolean, live: boolean) {
  if (!connected) {
    return "Waiting for connection";
  }

  if (!live) {
    return "Waiting for live data";
  }

  return undefined;
}

function AuditMetricCard({
  label,
  value,
  helper
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-[1.75rem] border border-border/70 bg-card/90 p-5 shadow-[0_30px_80px_-48px_rgba(15,23,42,0.38)] backdrop-blur-xl">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
      <p className="mt-4 font-display text-3xl font-semibold tracking-tight text-foreground">{value}</p>
      <p className="mt-2 text-sm text-muted-foreground">{helper}</p>
    </div>
  );
}

export function Overview({
  healthScore,
  statusLabel,
  hasScan,
  auditData,
  gsc,
  ga,
  gscLoading,
  gaLoading
}: {
  healthScore: number | null;
  statusLabel: string;
  hasScan: boolean;
  auditData: ClientDashboardPayload["auditData"];
  gsc: GscDashboardData;
  ga: GaDashboardData;
  gscLoading?: boolean;
  gaLoading?: boolean;
}) {
  const circumference = 2 * Math.PI * 64;
  const progress = circumference - ((healthScore ?? 0) / 100) * circumference;
  const tone = scoreTone(healthScore);
  const hasLiveSearch = gsc.source === "live";
  const hasLiveAnalytics = ga.source === "live";
  const searchMetricStatus = metricStatus(gsc.connected, hasLiveSearch);
  const analyticsMetricStatus = metricStatus(ga.connected, hasLiveAnalytics);
  const scoreSummary = hasScan
    ? "This review combines the latest technical scan with live Google data when it is available."
    : "Your first completed review will surface clear issues, recommendations, and business-friendly next steps here.";

  return (
    <div className="space-y-6">
      {gscLoading || gaLoading ? (
        <div className="flex items-center gap-3 rounded-full border border-border bg-card/70 px-4 py-3">
          <Skeleton className="h-2 w-20 bg-muted" />
          <Skeleton className="h-2 w-14 bg-muted" />
          <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Refreshing live Google data</span>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        <div className="rounded-[1.9rem] border border-border/70 bg-card/90 p-6 shadow-[0_30px_80px_-48px_rgba(15,23,42,0.38)] backdrop-blur-xl">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-background/80 text-foreground">
                <Gauge className="h-5 w-5" />
              </span>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Review Status</p>
                <p className="text-sm text-muted-foreground">A business-readable snapshot of the latest website review</p>
              </div>
            </div>
            <Badge variant={reviewStatusVariant(healthScore)}>{statusLabel}</Badge>
          </div>

          {healthScore === null ? (
            <div className="mt-6 rounded-[1.7rem] border border-dashed border-border bg-background/80 p-6">
              <p className="font-display text-3xl font-semibold text-foreground">No completed review yet</p>
              <p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">{scoreSummary}</p>
            </div>
          ) : (
            <div className="mt-6 flex flex-col items-center justify-center gap-4 text-center sm:flex-row sm:text-left">
              <div className="relative">
                <svg viewBox="0 0 160 160" className="h-40 w-40 -rotate-90">
                  <circle cx="80" cy="80" r="64" stroke="rgba(148,163,184,0.18)" strokeWidth="12" fill="none" />
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
                  <span className="font-display text-4xl font-semibold text-foreground">{healthScore}</span>
                  <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Out of 100</span>
                </div>
              </div>
              <div className="space-y-3">
                <p className="font-display text-3xl font-semibold text-foreground">{statusLabel}</p>
                <p className="max-w-xs text-sm leading-6 text-muted-foreground">{scoreSummary}</p>
              </div>
            </div>
          )}

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-border bg-background/80 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Search Console</p>
                <Badge variant={sourceVariant(gsc.source)}>{sourceLabel(gsc.source)}</Badge>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                {hasLiveSearch
                  ? `${gsc.summary.indexedPages.toLocaleString()} indexed pages tracked.`
                  : gsc.connected
                    ? "Search visibility cards will update once live data is available."
                    : "Connect Google Search Console to unlock search visibility metrics."}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-background/80 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">GA4</p>
                <Badge variant={sourceVariant(ga.source)}>{sourceLabel(ga.source)}</Badge>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                {hasLiveAnalytics
                  ? `${ga.summary.sessions.toLocaleString()} sessions recorded in the last 28 days.`
                  : ga.connected
                    ? "Traffic and engagement cards will update once GA4 sync succeeds."
                    : "Connect GA4 to unlock sessions, engagement, and audience metrics."}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <StatCard
            label="Clicks"
            value={hasLiveSearch ? gsc.summary.clicks.toLocaleString() : "—"}
            subtext="Search clicks in the last 28 days"
            change={hasLiveSearch ? gsc.comparison.clicks : null}
            status={searchMetricStatus}
          />
          <StatCard
            label="Impressions"
            value={hasLiveSearch ? gsc.summary.impressions.toLocaleString() : "—"}
            subtext="Times the site appeared in Google"
            change={hasLiveSearch ? gsc.comparison.impressions : null}
            status={searchMetricStatus}
          />
          <StatCard
            label="Average Position"
            value={hasLiveSearch ? gsc.summary.avgPosition.toFixed(1) : "—"}
            subtext="Lower numbers mean stronger rankings"
            change={hasLiveSearch ? gsc.comparison.avgPosition : null}
            status={searchMetricStatus}
          />
          <StatCard
            label="Sessions"
            value={hasLiveAnalytics ? ga.summary.sessions.toLocaleString() : "—"}
            subtext="Visits captured by GA4"
            change={hasLiveAnalytics ? ga.comparison.sessions : null}
            status={analyticsMetricStatus}
          />
          <StatCard
            label="Bounce Rate"
            value={hasLiveAnalytics ? `${ga.summary.bounceRate.toFixed(1)}%` : "—"}
            subtext="Lower rates usually signal stronger engagement"
            change={hasLiveAnalytics ? ga.comparison.bounceRate : null}
            status={analyticsMetricStatus}
          />
          <StatCard
            label="Avg Session Duration"
            value={hasLiveAnalytics ? `${Math.round(ga.summary.averageSessionDuration)} sec` : "—"}
            subtext="Average time visitors stay per session"
            change={hasLiveAnalytics ? ga.comparison.averageSessionDuration : null}
            status={analyticsMetricStatus}
          />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-[1.8rem] border border-border/70 bg-card/90 p-5 shadow-[0_30px_80px_-48px_rgba(15,23,42,0.38)] backdrop-blur-xl">
          <div className="mb-5 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Performance Scores
            </p>
            <p className="text-sm text-muted-foreground">
              These scores come from the latest technical scan and stay visible even without Google connections.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <AuditMetricCard
              label="Performance"
              value={formatVitalValue(auditData?.overview.performance ?? null, "score")}
              helper="How fast the site feels to visitors"
            />
            <AuditMetricCard
              label="SEO"
              value={formatVitalValue(auditData?.overview.seo ?? null, "score")}
              helper="How clearly search engines can understand the site"
            />
            <AuditMetricCard
              label="Accessibility"
              value={formatVitalValue(auditData?.overview.accessibility ?? null, "score")}
              helper="How easy the site is for all visitors to use"
            />
            <AuditMetricCard
              label="Best Practices"
              value={formatVitalValue(auditData?.overview.bestPractices ?? null, "score")}
              helper="Technical quality and browser safety checks"
            />
          </div>
        </div>

        <div className="rounded-[1.8rem] border border-border/70 bg-card/90 p-5 shadow-[0_30px_80px_-48px_rgba(15,23,42,0.38)] backdrop-blur-xl">
          <div className="mb-5 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Core Web Vitals
            </p>
            <p className="text-sm text-muted-foreground">
              These loading and stability signals come from the latest technical scan, so they are always available after a scan.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <AuditMetricCard label="LCP" value={formatVitalValue(auditData?.overview.lcp ?? null, "seconds")} helper="How long the main content takes to appear" />
            <AuditMetricCard label="FCP" value={formatVitalValue(auditData?.overview.fcp ?? null, "milliseconds_as_seconds")} helper="How quickly the first visible content shows up" />
            <AuditMetricCard label="TBT" value={formatVitalValue(auditData?.overview.tbt ?? null, "milliseconds")} helper="How much blocking work delays interaction" />
            <AuditMetricCard label="CLS" value={formatVitalValue(auditData?.overview.cls ?? null, "shift")} helper="How stable the page feels while it loads" />
            <AuditMetricCard label="TTI" value={formatVitalValue(auditData?.overview.tti ?? null, "milliseconds_as_seconds")} helper="How long it takes before the page feels ready" />
            <AuditMetricCard label="Speed Index" value={formatVitalValue(auditData?.overview.speedIndex ?? null, "milliseconds_as_seconds")} helper="How quickly the page looks visually complete" />
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <GSCChart
          data={gsc.daily}
          variant="traffic"
          loading={gscLoading}
          emptyTitle={gsc.connected ? "No search trend yet" : "Connect Google Search Console to see this data"}
          emptyBody={
            gsc.connected
              ? "This chart will populate after Search Console returns live data for this site."
              : "Search clicks and impressions will appear here once Google Search Console is connected."
          }
        />
        <GSCChart
          data={gsc.daily}
          variant="position"
          loading={gscLoading}
          emptyTitle={gsc.connected ? "No ranking history yet" : "Connect Google Search Console to see this data"}
          emptyBody={
            gsc.connected
              ? "This chart will populate after Search Console returns live data for this site."
              : "Average ranking movement will appear here once Google Search Console is connected."
          }
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-[1.8rem] border border-border/70 bg-card/90 p-5 shadow-[0_30px_80px_-48px_rgba(15,23,42,0.38)] backdrop-blur-xl">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Sessions Trend</p>
              <div className="flex items-end gap-3">
                <p className="font-display text-4xl font-semibold text-foreground">
                  {hasLiveAnalytics ? ga.summary.sessions.toLocaleString() : "—"}
                </p>
                {hasLiveAnalytics ? (
                  <div className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-300">
                    <ArrowUpRight className="h-4 w-4" />
                    {`${ga.comparison.sessions > 0 ? "+" : ""}${ga.comparison.sessions.toFixed(1)}%`}
                  </div>
                ) : (
                  <Badge variant="outline">{analyticsMetricStatus ?? "Waiting for live data"}</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">Daily session activity from Google Analytics 4.</p>
            </div>
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-background/80 text-foreground">
              <Sparkles className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-4">
            <GAChart
              variant="sessions"
              daily={ga.daily}
              loading={gaLoading && ga.source !== "live"}
              emptyTitle={ga.connected ? "Waiting for live analytics" : "Connect GA4 to see this data"}
              emptyBody={
                ga.connected
                  ? "Sessions will appear here after GA4 returns the first successful sync."
                  : "Daily sessions will appear here once Google Analytics 4 is connected."
              }
            />
          </div>
        </div>

        <div className="rounded-[1.8rem] border border-border/70 bg-card/90 p-5 shadow-[0_30px_80px_-48px_rgba(15,23,42,0.38)] backdrop-blur-xl">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Bounce Rate</p>
              <p className={`font-display text-4xl font-semibold ${hasLiveAnalytics ? bounceTone(ga.summary.bounceRate) : "text-foreground"}`}>
                {hasLiveAnalytics ? `${ga.summary.bounceRate.toFixed(1)}%` : "—"}
              </p>
              <p className="text-sm text-muted-foreground">Lower rates usually signal stronger landing-page engagement.</p>
            </div>
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-background/80 text-foreground">
              <Waves className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-border bg-background/80 p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Source</p>
              <div className="mt-2">
                <Badge variant={sourceVariant(ga.source)}>{sourceLabel(ga.source)}</Badge>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-background/80 p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Trend</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {hasLiveAnalytics
                  ? `${ga.comparison.bounceRate > 0 ? "+" : ""}${ga.comparison.bounceRate.toFixed(1)}%`
                  : analyticsMetricStatus ?? "Waiting for live data"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
