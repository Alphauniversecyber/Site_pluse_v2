"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { CheckCircle2, Globe2, Link2, Signal, XCircle } from "lucide-react";

import type { ClientDashboardPayload, GaDashboardData, GscDashboardData } from "@/types";
import { GoogleSignals } from "@/components/client-dashboard/GoogleSignals";
import { Issues } from "@/components/client-dashboard/IssuesPlainEnglish";
import { Overview } from "@/components/client-dashboard/Overview";
import { Recommendations } from "@/components/client-dashboard/RecommendationsPlainEnglish";
import { SitePulseLogo } from "@/components/brand/sitepulse-logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { fetchJson } from "@/lib/api-client";
import { formatDateTime } from "@/lib/utils";

type TabKey = "overview" | "issues" | "recommendations" | "google-signals";

const TAB_ITEMS: Array<{ key: TabKey; label: string }> = [
  { key: "overview", label: "Overview" },
  { key: "issues", label: "Issues" },
  { key: "recommendations", label: "Recommendations" },
  { key: "google-signals", label: "Google Signals" }
];

function StatusPill({
  label,
  connected
}: {
  label: string;
  connected: boolean;
}) {
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] ${
        connected
          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
          : "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-200"
      }`}
    >
      {connected ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
      {label}: {connected ? "Connected" : "Not connected"}
    </div>
  );
}

function SyncNotice({
  service
}: {
  service:
    | "gsc_connected"
    | "ga_connected"
    | "gsc_needs_property"
    | "ga_needs_property"
    | "gsc_pending"
    | "ga_pending";
}) {
  return (
    <div
      className={`rounded-[1.6rem] border px-5 py-4 text-sm ${
        service === "gsc_connected" || service === "ga_connected"
          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-100"
          : "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-100"
      }`}
    >
      {service === "gsc_connected"
        ? "Google Search Console connected. SitePulse will use live search data as soon as Google returns it successfully."
        : service === "ga_connected"
          ? "GA4 connected. SitePulse will use live analytics data as soon as Google returns it successfully."
          : service === "gsc_pending"
            ? "Google returned from Search Console, but SitePulse could not verify a saved connection yet. Refresh once, and if it still shows Not connected, reconnect and check property access."
            : service === "ga_pending"
              ? "Google returned from GA4, but SitePulse could not verify a saved connection yet. Refresh once, and if it still shows Not connected, reconnect and check property access."
          : service === "gsc_needs_property"
            ? "Google Search Console authorization succeeded, but no matching Search Console property was found for this site."
            : "Google Analytics authorization succeeded, but no matching GA4 web data stream was found for this site."}
    </div>
  );
}

export function TabNav({
  dashboard,
  connectionNotice
}: {
  dashboard: ClientDashboardPayload;
  connectionNotice?:
    | "gsc_connected"
    | "ga_connected"
    | "gsc_needs_property"
    | "ga_needs_property"
    | "gsc_pending"
    | "ga_pending"
    | null;
}) {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [gsc, setGsc] = useState<GscDashboardData>(dashboard.gsc);
  const [ga, setGa] = useState<GaDashboardData>(dashboard.ga);
  const [gscLoading, setGscLoading] = useState(dashboard.connections.gsc);
  const [gaLoading, setGaLoading] = useState(dashboard.connections.ga);
  const [tabTransitioning, startTabTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;

    async function hydrateGsc() {
      if (!dashboard.connections.gsc) {
        setGscLoading(false);
        return;
      }

      try {
        const payload = await fetchJson<GscDashboardData>(
          `/api/d/gsc-data?token=${encodeURIComponent(dashboard.token)}`
        );

        if (!cancelled) {
          setGsc(payload);
        }
      } catch (error) {
        console.error("[client-dashboard] gsc fetch failed", error);
      } finally {
        if (!cancelled) {
          setGscLoading(false);
        }
      }
    }

    void hydrateGsc();

    return () => {
      cancelled = true;
    };
  }, [dashboard.connections.gsc, dashboard.token]);

  useEffect(() => {
    let cancelled = false;

    async function hydrateGa() {
      if (!dashboard.connections.ga) {
        setGaLoading(false);
        return;
      }

      try {
        const payload = await fetchJson<GaDashboardData>(
          `/api/d/ga-data?token=${encodeURIComponent(dashboard.token)}`
        );

        if (!cancelled) {
          setGa(payload);
        }
      } catch (error) {
        console.error("[client-dashboard] ga fetch failed", error);
      } finally {
        if (!cancelled) {
          setGaLoading(false);
        }
      }
    }

    void hydrateGa();

    return () => {
      cancelled = true;
    };
  }, [dashboard.connections.ga, dashboard.token]);

  const lastUpdated = useMemo(() => {
    return [dashboard.lastUpdated, gsc.lastSyncedAt, ga.lastSyncedAt]
      .filter(Boolean)
      .sort()
      .at(-1);
  }, [dashboard.lastUpdated, ga.lastSyncedAt, gsc.lastSyncedAt]);

  const liveDataWarnings = useMemo(() => {
    const warnings: string[] = [];

    if (dashboard.connections.gsc && !gscLoading && gsc.source === "unavailable") {
      warnings.push(
        "Search Console is connected, but SitePulse still has not received a successful live sync. Check property access and confirm the Search Console API is enabled."
      );
    }

    if (dashboard.connections.ga && !gaLoading && ga.source === "unavailable") {
      warnings.push(
        "GA4 is connected, but SitePulse still has not received a successful live sync. Check property access and confirm the Analytics Data API and Analytics Admin API are enabled."
      );
    }

    return warnings;
  }, [dashboard.connections.ga, dashboard.connections.gsc, ga.source, gaLoading, gsc.source, gscLoading]);

  const content = useMemo(() => {
    switch (activeTab) {
      case "issues":
        return (
          <Issues
            issues={dashboard.issues}
            hasScan={dashboard.hasScan}
            websiteUrl={dashboard.website.url}
            gsc={gsc}
            ga={ga}
          />
        );
      case "recommendations":
        return (
          <Recommendations
            token={dashboard.token}
            recommendations={dashboard.recommendations}
            hasScan={dashboard.hasScan}
            websiteUrl={dashboard.website.url}
            gsc={gsc}
            ga={ga}
          />
        );
      case "google-signals":
        return (
          <GoogleSignals
            token={dashboard.token}
            gsc={gsc}
            ga={ga}
            gscLoading={gscLoading}
            gaLoading={gaLoading}
          />
        );
      case "overview":
      default:
        return (
          <Overview
            healthScore={dashboard.healthScore}
            statusLabel={dashboard.statusLabel}
            hasScan={dashboard.hasScan}
            gsc={gsc}
            ga={ga}
            gscLoading={gscLoading}
            gaLoading={gaLoading}
          />
        );
    }
  }, [
    activeTab,
    dashboard.healthScore,
    dashboard.hasScan,
    dashboard.issues,
    dashboard.recommendations,
    dashboard.statusLabel,
    dashboard.token,
    dashboard.website.url,
    ga,
    gaLoading,
    gsc,
    gscLoading
  ]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.12),transparent_58%)] dark:bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.16),transparent_58%)]" />
      <div className="relative mx-auto w-full max-w-[1400px] px-4 py-5 sm:px-6 lg:px-8">
        <div className="rounded-[2rem] border border-border/70 bg-card/90 p-4 shadow-[0_30px_90px_-52px_rgba(15,23,42,0.42)] backdrop-blur-2xl sm:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-4">
              <div className="rounded-2xl border border-border bg-background/80 px-4 py-3">
                <span className="dark:hidden">
                  <SitePulseLogo variant="dark" className="h-8 w-[132px] sm:w-[148px]" priority />
                </span>
                <span className="hidden dark:inline-flex">
                  <SitePulseLogo variant="light" className="h-8 w-[132px] sm:w-[148px]" priority />
                </span>
              </div>
              <ThemeToggle />
            </div>

            <div className="flex min-w-0 flex-1 items-center justify-center gap-3 rounded-[1.6rem] border border-border bg-background/80 px-4 py-4 text-center">
              <Globe2 className="h-4 w-4 shrink-0 text-sky-500 dark:text-sky-300" />
              <p className="min-w-0 truncate font-display text-lg font-semibold text-foreground sm:text-xl">
                {dashboard.website.url}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3">
              <StatusPill label="GSC" connected={dashboard.connections.gsc} />
              <StatusPill label="GA4" connected={dashboard.connections.ga} />
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 border-t border-border/70 pt-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-sky-500 dark:text-sky-300" />
              <span>{dashboard.clientName}</span>
            </div>
            <div className="flex items-center gap-2">
              <Signal className="h-4 w-4 text-emerald-500 dark:text-emerald-300" />
              <span>Last updated {formatDateTime(lastUpdated)}</span>
            </div>
          </div>
        </div>

        <div className="mt-6 space-y-6">
          {connectionNotice ? <SyncNotice service={connectionNotice} /> : null}
          {liveDataWarnings.length ? (
            <div className="space-y-3">
              {liveDataWarnings.map((warning) => (
                <div
                  key={warning}
                  className="rounded-[1.6rem] border border-amber-500/20 bg-amber-500/10 px-5 py-4 text-sm text-amber-700 dark:text-amber-100"
                >
                  {warning}
                </div>
              ))}
            </div>
          ) : null}

          <div className="flex gap-3 overflow-x-auto pb-1">
            {TAB_ITEMS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => startTabTransition(() => setActiveTab(tab.key))}
                className={`whitespace-nowrap rounded-full border px-5 py-3 text-sm font-semibold transition-colors ${
                  activeTab === tab.key
                    ? "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-100"
                    : "border-border bg-card/80 text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div
            key={activeTab}
            className={`${
              tabTransitioning ? "opacity-90" : "opacity-100"
            } animate-in fade-in-0 duration-300`}
          >
            {content}
          </div>
        </div>
      </div>
    </div>
  );
}
