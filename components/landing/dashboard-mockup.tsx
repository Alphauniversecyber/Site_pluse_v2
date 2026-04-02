"use client";

import { Bell, Ellipsis, Home, Settings2, Signal, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";

import { SitePulseLogo } from "@/components/brand/sitepulse-logo";
import { Badge } from "@/components/ui/badge";

const scenes = [
  {
    greeting: "Good morning, Lasindu",
    message: "Two client reports are ready to send before Monday standup.",
    miniCards: [
      { label: "Performance", value: 94, tone: "bg-emerald-500" },
      { label: "SEO", value: 87, tone: "bg-emerald-500" },
      { label: "Accessibility", value: 76, tone: "bg-orange-500" },
      { label: "Best Practices", value: 91, tone: "bg-emerald-500" }
    ],
    chart: [14, 18, 17, 24, 22, 27, 31, 29, 36, 40, 38, 46],
    websites: [
      { label: "MyWebsite.com", performance: 95, seo: 88, accessibility: 80, status: "Online", uptime: "99.9%" },
      { label: "ShopMaster.io", performance: 92, seo: 85, accessibility: 74, status: "Online", uptime: "99.8%" },
      { label: "TravelBlog.net", performance: 89, seo: 81, accessibility: 78, status: "Online", uptime: "99.7%" }
    ]
  },
  {
    greeting: "Monday report run complete",
    message: "One accessibility regression was flagged before your client noticed.",
    miniCards: [
      { label: "Performance", value: 91, tone: "bg-emerald-500" },
      { label: "SEO", value: 84, tone: "bg-emerald-500" },
      { label: "Accessibility", value: 68, tone: "bg-rose-500" },
      { label: "Best Practices", value: 89, tone: "bg-emerald-500" }
    ],
    chart: [18, 24, 28, 26, 34, 37, 42, 40, 48, 46, 55, 60],
    websites: [
      { label: "StudioNorth.dev", performance: 93, seo: 86, accessibility: 71, status: "Alert", uptime: "99.6%" },
      { label: "HarborDental.co", performance: 88, seo: 79, accessibility: 64, status: "Needs review", uptime: "99.5%" },
      { label: "BaysideLaw.com", performance: 90, seo: 82, accessibility: 72, status: "Online", uptime: "99.8%" }
    ]
  },
  {
    greeting: "Agency overview is stable",
    message: "White-label summaries were delivered to three client inboxes overnight.",
    miniCards: [
      { label: "Performance", value: 96, tone: "bg-emerald-500" },
      { label: "SEO", value: 89, tone: "bg-emerald-500" },
      { label: "Accessibility", value: 82, tone: "bg-emerald-500" },
      { label: "Best Practices", value: 94, tone: "bg-emerald-500" }
    ],
    chart: [10, 14, 19, 23, 27, 35, 33, 42, 49, 53, 58, 64],
    websites: [
      { label: "OakCreative.io", performance: 96, seo: 90, accessibility: 84, status: "Online", uptime: "99.9%" },
      { label: "ModernStay.com", performance: 91, seo: 87, accessibility: 78, status: "Online", uptime: "99.8%" },
      { label: "Evergreen.fit", performance: 88, seo: 80, accessibility: 74, status: "Queued", uptime: "99.7%" }
    ]
  }
] as const;

function getStatusTone(status: string) {
  if (status === "Alert") {
    return "bg-rose-400";
  }

  if (status === "Needs review") {
    return "bg-orange-400";
  }

  if (status === "Queued") {
    return "bg-blue-400";
  }

  return "bg-green-400";
}

export function DashboardMockup() {
  const [sceneIndex, setSceneIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduceMotion(media.matches);

    update();
    media.addEventListener("change", update);

    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      return;
    }

    const interval = window.setInterval(() => {
      setSceneIndex((current) => (current + 1) % scenes.length);
    }, 3600);

    return () => window.clearInterval(interval);
  }, [reduceMotion]);

  const scene = scenes[sceneIndex];

  return (
    <div className="relative mx-auto w-full max-w-[460px] overflow-hidden rounded-[2rem] border border-blue-400/20 bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.25),_transparent_38%),linear-gradient(180deg,_#0a1026,_#152c81)] p-3 shadow-[0_36px_90px_-46px_rgba(37,99,235,0.58)] sm:max-w-[500px] sm:p-5 md:max-w-[520px] md:rounded-[2.25rem] md:p-6">
      <div className="hero-glow-pulse absolute left-4 top-8 h-28 w-28 rounded-full bg-blue-500/20 blur-3xl sm:left-8 sm:h-44 sm:w-44" />
      <div className="hero-glow-pulse absolute bottom-8 right-6 h-24 w-24 rounded-full bg-blue-400/25 blur-3xl sm:bottom-10 sm:right-10 sm:h-40 sm:w-40" />

      <div className="hero-device-float relative mx-auto w-full max-w-[242px] rounded-[2.1rem] border border-white/20 bg-slate-950 p-2 shadow-[0_30px_70px_-28px_rgba(15,23,42,0.95)] sm:max-w-[286px] sm:rounded-[2.3rem] sm:p-2.5 md:max-w-[320px]">
        <div className="rounded-[1.9rem] border border-white/10 bg-[linear-gradient(180deg,_#101935,_#0c1228)] px-3.5 pb-3.5 pt-3 text-white sm:rounded-[2.2rem] sm:px-4 sm:pb-4 sm:pt-3.5 md:px-5 md:pb-5 md:pt-4">
          <div className="mb-4 flex items-center justify-between px-1 text-xs text-slate-300">
            <span>9:41</span>
            <div className="rounded-full bg-black/80 px-5 py-1 text-[10px] text-blue-300">SitePulse</div>
            <div className="flex items-center gap-2">
              <Signal className="h-3.5 w-3.5" />
              <div className="h-3 w-6 rounded-sm border border-white/70 p-[1px]">
                <div className="h-full w-4 rounded-[2px] bg-white" />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 border-b border-white/10 pb-4">
            <SitePulseLogo markOnly className="h-9 w-9" />
            <span className="font-display text-2xl font-semibold tracking-tight">SitePulse</span>
          </div>

          <div className="pt-5">
            <h3 className="min-h-[64px] text-2xl font-semibold tracking-tight sm:min-h-[72px] sm:text-3xl">
              {scene.greeting}
            </h3>
            <p className="mt-2 min-h-[40px] text-sm text-slate-400">{scene.message}</p>

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {scene.miniCards.map((card) => (
                <div key={card.label} className="animate-fade-in rounded-2xl border border-white/10 bg-white/5 p-3 shadow-inner">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">{card.label}</p>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-3xl font-semibold">{card.value}</span>
                    <span className={`h-3 w-3 rounded-full ${card.tone}`} />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
              <div className="flex items-end gap-2">
                {scene.chart.map((height, index) => (
                  <div key={`${sceneIndex}-${index}`} className="flex-1 rounded-full bg-blue-500/20 p-[1px]">
                    <div
                      className="w-full rounded-full bg-gradient-to-t from-blue-700 via-blue-500 to-cyan-300"
                      style={{ height }}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 space-y-4">
              {scene.websites.map((site) => (
                <div key={site.label} className="animate-fade-in rounded-[1.6rem] border border-white/10 bg-white/5 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-3">
                        <span className={`h-3.5 w-3.5 rounded-full ${getStatusTone(site.status)}`} />
                        <h4 className="text-lg font-semibold sm:text-xl">{site.label}</h4>
                      </div>
                      <p className="mt-1 text-sm text-slate-400">{`Status: ${site.status} - Uptime: ${site.uptime}`}</p>
                    </div>
                    <button className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-300">
                      <Ellipsis className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/10 pt-4 text-sm">
                    <div className="rounded-2xl bg-slate-950/60 px-3 py-2">
                      <span className="text-slate-400">Performance</span>
                      <p className="mt-1 text-lg font-semibold">{site.performance}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-950/60 px-3 py-2">
                      <span className="text-slate-400">SEO</span>
                      <p className="mt-1 text-lg font-semibold">{site.seo}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-950/60 px-3 py-2">
                      <span className="text-slate-400">Access</span>
                      <p className="mt-1 text-lg font-semibold">{site.accessibility}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 grid grid-cols-4 gap-3 rounded-[1.6rem] border border-white/10 bg-white/5 px-4 py-3 text-center text-slate-400">
              <div className="flex flex-col items-center gap-1 text-blue-400">
                <Home className="h-5 w-5" />
                <span className="text-xs">Dashboard</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <Bell className="h-5 w-5" />
                <span className="text-xs">Alerts</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <TrendingUp className="h-5 w-5" />
                <span className="text-xs">Reports</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <Settings2 className="h-5 w-5" />
                <span className="text-xs">Settings</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute -left-2 top-16 hidden w-44 rounded-[1.8rem] border border-white/10 bg-slate-950/80 p-4 backdrop-blur xl:block">
        <Badge variant="success">Live monitoring</Badge>
        <p className="mt-4 text-sm text-slate-300">15 client websites checked automatically every Monday morning.</p>
      </div>
      <div className="absolute -right-4 bottom-16 hidden w-48 rounded-[1.8rem] border border-blue-300/20 bg-blue-500/10 p-4 text-slate-100 backdrop-blur xl:block">
        <p className="text-xs uppercase tracking-[0.18em] text-blue-200">White-label ready</p>
        <p className="mt-3 text-sm">PDF reports, alerts, and client-facing updates all carry your agency branding.</p>
      </div>
    </div>
  );
}
