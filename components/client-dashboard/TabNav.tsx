"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { CheckCircle2, Globe2, Link2, Signal, XCircle } from "lucide-react";

import type { ClientDashboardPayload, GaDashboardData, GscDashboardData } from "@/types";
import { GoogleSignals } from "@/components/client-dashboard/GoogleSignals";
import { Issues } from "@/components/client-dashboard/IssuesAI";
import { Overview } from "@/components/client-dashboard/Overview";
import { Recommendations } from "@/components/client-dashboard/RecommendationsAI";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { useTheme } from "@/components/theme/theme-provider";
import { fetchJson } from "@/lib/api-client";
import { formatDateTime } from "@/lib/utils";

type TabKey = "overview" | "issues" | "recommendations" | "google-signals";
type SavedAiIssue = {
  title: string;
  severity: "critical" | "warning" | "info";
  description: string;
  impact: string;
  category: string;
};

type SavedAiRecommendation = {
  title: string;
  priority: "high" | "medium" | "low";
  description: string;
  expectedResult: string;
  effort: "low" | "medium" | "high";
  category: string;
};

type DashboardWithSavedAi = ClientDashboardPayload & {
  aiIssues?: {
    items: SavedAiIssue[] | null;
    generatedAt: string | null;
  };
  aiRecommendations?: {
    items: SavedAiRecommendation[] | null;
    generatedAt: string | null;
  };
};

const TAB_ITEMS: Array<{ key: TabKey; label: string }> = [
  { key: "overview", label: "Overview" },
  { key: "issues", label: "Issues" },
  { key: "recommendations", label: "Recommendations" },
  { key: "google-signals", label: "Google Signals" }
] as const;

const SITEPULSE_LOGOS = {
  light: "https://www.trysitepulse.com/brand/sitepulse-logo-light.svg",
  dark: "https://www.trysitepulse.com/brand/sitepulse-logo-dark.svg"
} as const;

function formatDisplayUrl(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.trim().replace("#", "");
  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((character) => `${character}${character}`)
          .join("")
      : normalized;

  if (expanded.length !== 6) {
    return `rgba(59,130,246,${alpha})`;
  }

  const red = Number.parseInt(expanded.slice(0, 2), 16);
  const green = Number.parseInt(expanded.slice(2, 4), 16);
  const blue = Number.parseInt(expanded.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function buildDisconnectedGsc(property: string | null): GscDashboardData {
  return {
    connected: false,
    source: "disconnected",
    property,
    lastSyncedAt: null,
    summary: {
      clicks: 0,
      impressions: 0,
      avgPosition: 0,
      indexedPages: 0,
      sitemapSubmitted: 0,
      ctr: 0
    },
    comparison: {
      clicks: 0,
      impressions: 0,
      avgPosition: 0,
      indexedPages: 0
    },
    daily: [],
    topQueries: [],
    topPages: [],
    sitemaps: []
  };
}

function buildDisconnectedGa(propertyId: string | null): GaDashboardData {
  return {
    connected: false,
    source: "disconnected",
    propertyId,
    lastSyncedAt: null,
    summary: {
      sessions: 0,
      bounceRate: 0,
      averageSessionDuration: 0
    },
    comparison: {
      sessions: 0,
      bounceRate: 0,
      averageSessionDuration: 0
    },
    daily: [],
    sparkline: [],
    topPages: [],
    devices: [],
    countries: []
  };
}

function PlaceholderLogo({
  name,
  accentColor
}: {
  name: string;
  accentColor: string;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "SP";

  return (
    <div
      className="flex h-12 w-12 items-center justify-center rounded-2xl border text-sm font-semibold text-white"
      style={{
        borderColor: hexToRgba(accentColor, 0.28),
        backgroundColor: accentColor
      }}
    >
      {initials}
    </div>
  );
}

function StatusPill({
  label,
  connected,
  loading,
  accentColor,
  onConnect,
  onDisconnect
}: {
  label: string;
  connected: boolean;
  loading: boolean;
  accentColor: string;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-border bg-background/70 p-1">
      <button
        type="button"
        onClick={connected ? onDisconnect : onConnect}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition-colors"
        style={
          connected
            ? {
                borderColor: hexToRgba(accentColor, 0.2),
                backgroundColor: hexToRgba(accentColor, 0.14),
                color: accentColor
              }
            : undefined
        }
      >
        {connected ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
        {label}: {loading ? "Working" : connected ? "Connected" : "Not connected"}
      </button>
      {connected ? (
        <button
          type="button"
          onClick={onDisconnect}
          disabled={loading}
          className="rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          {loading ? "Disconnecting" : "Disconnect"}
        </button>
      ) : null}
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
  dashboard: DashboardWithSavedAi;
  connectionNotice?:
    | "gsc_connected"
    | "ga_connected"
    | "gsc_needs_property"
    | "ga_needs_property"
    | "gsc_pending"
    | "ga_pending"
    | null;
}) {
  const { resolvedTheme } = useTheme();
  const accentColor = dashboard.branding.accentColor || "#3b82f6";
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [gsc, setGsc] = useState<GscDashboardData>(dashboard.gsc);
  const [ga, setGa] = useState<GaDashboardData>(dashboard.ga);
  const [connections, setConnections] = useState(dashboard.connections);
  const [gscLoading, setGscLoading] = useState(dashboard.connections.gsc);
  const [gaLoading, setGaLoading] = useState(dashboard.connections.ga);
  const [connectionAction, setConnectionAction] = useState<"gsc" | "ga" | null>(null);
  const [tabTransitioning, startTabTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;

    async function hydrateGsc() {
      if (!connections.gsc) {
        setGscLoading(false);
        return;
      }

      setGscLoading(true);

      try {
        const payload = await fetchJson<GscDashboardData>(
          `/api/d/gsc-data?token=${encodeURIComponent(dashboard.token)}`
        );

        if (!cancelled) {
          setGsc(payload);
          setConnections((current) => ({ ...current, gsc: payload.connected }));
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
  }, [connections.gsc, dashboard.token]);

  useEffect(() => {
    let cancelled = false;

    async function hydrateGa() {
      if (!connections.ga) {
        setGaLoading(false);
        return;
      }

      setGaLoading(true);

      try {
        const payload = await fetchJson<GaDashboardData>(
          `/api/d/ga-data?token=${encodeURIComponent(dashboard.token)}`
        );

        if (!cancelled) {
          setGa(payload);
          setConnections((current) => ({ ...current, ga: payload.connected }));
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
  }, [connections.ga, dashboard.token]);

  const lastUpdated = useMemo(() => {
    return [dashboard.lastUpdated, gsc.lastSyncedAt, ga.lastSyncedAt]
      .filter(Boolean)
      .sort()
      .at(-1);
  }, [dashboard.lastUpdated, ga.lastSyncedAt, gsc.lastSyncedAt]);

  async function disconnectService(service: "gsc" | "ga") {
    setConnectionAction(service);

    try {
      await fetchJson<{ disconnected: boolean }>("/api/client/disconnect-google", {
        method: "POST",
        body: JSON.stringify({
          token: dashboard.token,
          service
        })
      });

      if (service === "gsc") {
        setConnections((current) => ({ ...current, gsc: false }));
        setGsc(buildDisconnectedGsc(gsc.property));
        setGscLoading(false);
      } else {
        setConnections((current) => ({ ...current, ga: false }));
        setGa(buildDisconnectedGa(ga.propertyId));
        setGaLoading(false);
      }
    } catch (error) {
      console.error("[client-dashboard] disconnect failed", error);
    } finally {
      setConnectionAction(null);
    }
  }

  function connectService(service: "gsc" | "ga") {
    const href = service === "gsc" ? "/api/d/connect/gsc" : "/api/d/connect/ga";
    window.location.assign(`${href}?token=${encodeURIComponent(dashboard.token)}`);
  }

  const content = useMemo(() => {
    switch (activeTab) {
      case "issues":
        return (
          <Issues
            token={dashboard.token}
            siteId={dashboard.website.id}
            hasScan={dashboard.hasScan}
            websiteUrl={dashboard.website.url}
            auditData={dashboard.auditData}
            gsc={gsc}
            ga={ga}
            accentColor={accentColor}
            initialResults={dashboard.aiIssues?.items ?? null}
            initialGeneratedAt={dashboard.aiIssues?.generatedAt ?? null}
          />
        );
      case "recommendations":
        return (
          <Recommendations
            token={dashboard.token}
            siteId={dashboard.website.id}
            hasScan={dashboard.hasScan}
            websiteUrl={dashboard.website.url}
            auditData={dashboard.auditData}
            gsc={gsc}
            ga={ga}
            accentColor={accentColor}
            initialResults={dashboard.aiRecommendations?.items ?? null}
            initialGeneratedAt={dashboard.aiRecommendations?.generatedAt ?? null}
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
            auditData={dashboard.auditData}
            gsc={gsc}
            ga={ga}
            gscLoading={gscLoading}
            gaLoading={gaLoading}
          />
        );
    }
  }, [
    activeTab,
    accentColor,
    dashboard.auditData,
    dashboard.hasScan,
    dashboard.healthScore,
    dashboard.statusLabel,
    dashboard.token,
    dashboard.website.id,
    dashboard.website.url,
    ga,
    gaLoading,
    gsc,
    gscLoading
  ]);

  const growthLogoSrc = resolvedTheme === "dark" ? SITEPULSE_LOGOS.dark : SITEPULSE_LOGOS.light;

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.12),transparent_58%)] dark:bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.16),transparent_58%)]" />
      <div className="relative mx-auto w-full max-w-[1400px] px-4 py-5 sm:px-6 lg:px-8">
        <div className="rounded-[2rem] border border-border/70 bg-card/90 p-4 shadow-[0_30px_90px_-52px_rgba(15,23,42,0.42)] backdrop-blur-2xl sm:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-4">
              <div className="rounded-2xl border border-border bg-white px-4 py-3 shadow-sm dark:bg-slate-950">
                {!dashboard.branding.useCustomLogo ? (
                  <img src={growthLogoSrc} alt="SitePulse" className="h-8 w-auto sm:h-9" />
                ) : dashboard.branding.logoUrl ? (
                  <div className="flex flex-col gap-2">
                    <img src={dashboard.branding.logoUrl} alt={dashboard.branding.placeholderName} className="h-8 w-auto max-w-[160px] object-contain sm:h-9" />
                    {dashboard.branding.label ? (
                      <span className="text-xs font-medium" style={{ color: accentColor }}>
                        {dashboard.branding.label}
                      </span>
                    ) : null}
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <PlaceholderLogo name={dashboard.branding.placeholderName} accentColor={accentColor} />
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-foreground">{dashboard.branding.placeholderName}</span>
                      {dashboard.branding.label ? (
                        <span className="text-xs font-medium" style={{ color: accentColor }}>
                          {dashboard.branding.label}
                        </span>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
              <ThemeToggle />
            </div>

            <div className="flex min-w-0 flex-1 items-start gap-3 rounded-[1.6rem] border border-border bg-background/80 px-4 py-4 text-left">
              <Globe2 className="h-4 w-4 shrink-0" style={{ color: accentColor }} />
              <p className="min-w-0 break-all font-display text-lg font-semibold leading-tight text-foreground sm:text-xl">
                {formatDisplayUrl(dashboard.website.url)}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3">
              <StatusPill
                label="GSC"
                connected={connections.gsc}
                loading={connectionAction === "gsc"}
                accentColor={accentColor}
                onConnect={() => connectService("gsc")}
                onDisconnect={() => void disconnectService("gsc")}
              />
              <StatusPill
                label="GA4"
                connected={connections.ga}
                loading={connectionAction === "ga"}
                accentColor={accentColor}
                onConnect={() => connectService("ga")}
                onDisconnect={() => void disconnectService("ga")}
              />
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 border-t border-border/70 pt-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4" style={{ color: accentColor }} />
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

          <div className="flex gap-3 overflow-x-auto pb-1">
            {TAB_ITEMS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => startTabTransition(() => setActiveTab(tab.key))}
                className="whitespace-nowrap rounded-full border px-5 py-3 text-sm font-semibold transition-colors"
                style={
                  activeTab === tab.key
                    ? {
                        borderColor: hexToRgba(accentColor, 0.35),
                        backgroundColor: hexToRgba(accentColor, 0.14),
                        color: accentColor
                      }
                    : undefined
                }
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div
            key={activeTab}
            className={`${tabTransitioning ? "opacity-90" : "opacity-100"} animate-in fade-in-0 duration-300`}
          >
            {content}
          </div>
        </div>
      </div>
    </div>
  );
}
