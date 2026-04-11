"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { CheckCircle2, Globe2, Link2, Signal, XCircle } from "lucide-react";

import type { ClientDashboardPayload, GaDashboardData, GscDashboardData } from "@/types";
import { GoogleSignals } from "@/components/client-dashboard/GoogleSignals";
import { Issues } from "@/components/client-dashboard/Issues";
import { Overview } from "@/components/client-dashboard/Overview";
import { Recommendations } from "@/components/client-dashboard/Recommendations";
import { SitePulseLogo } from "@/components/brand/sitepulse-logo";
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
          ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
          : "border-rose-400/20 bg-rose-400/10 text-rose-200"
      }`}
    >
      {connected ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
      {label}: {connected ? "Live" : "Not connected"}
    </div>
  );
}

function SyncNotice({
  service
}: {
  service: "gsc" | "ga";
}) {
  return (
    <div className="rounded-[1.6rem] border border-emerald-400/20 bg-emerald-400/10 px-5 py-4 text-sm text-emerald-100">
      {service === "gsc"
        ? "Google Search Console connected. Live search data will begin replacing the seeded mock data as soon as the refresh finishes."
        : "GA4 connected. Live session and audience data will begin replacing the seeded mock data as soon as the refresh finishes."}
    </div>
  );
}

export function TabNav({
  dashboard,
  connectionNotice
}: {
  dashboard: ClientDashboardPayload;
  connectionNotice?: "gsc" | "ga" | null;
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

  const content = useMemo(() => {
    switch (activeTab) {
      case "issues":
        return <Issues issues={dashboard.issues} />;
      case "recommendations":
        return (
          <Recommendations
            token={dashboard.token}
            recommendations={dashboard.recommendations}
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
    dashboard.issues,
    dashboard.recommendations,
    dashboard.statusLabel,
    dashboard.token,
    ga,
    gaLoading,
    gsc,
    gscLoading
  ]);

  return (
    <div className="min-h-screen bg-[#0F172A] text-white">
      <div className="mx-auto w-full max-w-[1400px] px-4 py-5 sm:px-6 lg:px-8">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-4 shadow-[0_30px_80px_-44px_rgba(15,23,42,0.85)] backdrop-blur-2xl sm:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                <SitePulseLogo variant="light" className="h-8 w-[132px] sm:w-[148px]" priority />
              </div>
            </div>

            <div className="flex min-w-0 flex-1 items-center justify-center gap-3 rounded-[1.6rem] border border-white/10 bg-[#08101f]/70 px-4 py-4 text-center">
              <Globe2 className="h-4 w-4 shrink-0 text-sky-300" />
              <p className="min-w-0 truncate font-display text-lg font-semibold text-white sm:text-xl">
                {dashboard.website.url}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3">
              <StatusPill label="GSC" connected={dashboard.connections.gsc} />
              <StatusPill label="GA4" connected={dashboard.connections.ga} />
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 border-t border-white/8 pt-4 text-sm text-slate-300 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-sky-300" />
              <span>{dashboard.clientName}</span>
            </div>
            <div className="flex items-center gap-2">
              <Signal className="h-4 w-4 text-emerald-300" />
              <span>Last updated {formatDateTime(lastUpdated)}</span>
            </div>
          </div>
        </div>

        <div className="mt-6 space-y-6">
          {connectionNotice ? <SyncNotice service={connectionNotice} /> : null}

          <div className="flex flex-wrap gap-3">
            {TAB_ITEMS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => startTabTransition(() => setActiveTab(tab.key))}
                className={`rounded-full border px-5 py-3 text-sm font-semibold transition-colors ${
                  activeTab === tab.key
                    ? "border-sky-400/30 bg-sky-400/15 text-white"
                    : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]"
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
