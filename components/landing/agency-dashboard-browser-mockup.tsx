import {
  Activity,
  BarChart3,
  Bell,
  FileText,
  Globe,
  LayoutDashboard,
  Lock,
  Plus,
  Settings
} from "lucide-react";

import { cn } from "@/lib/utils";

const dashboardSites = [
  {
    name: "daraz.lk",
    score: 67,
    status: "Needs Attention",
    statusColor: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300",
    scoreColor: "text-yellow-600 dark:text-yellow-300",
    issues: "6 issues",
    dot: "bg-yellow-400"
  },
  {
    name: "client-fashion.com",
    score: 45,
    status: "Critical",
    statusColor: "bg-red-500/20 text-red-600 dark:text-red-300",
    scoreColor: "text-red-600 dark:text-red-300",
    issues: "11 issues",
    dot: "bg-red-400"
  },
  {
    name: "techstartup.io",
    score: 82,
    status: "Good",
    statusColor: "bg-green-500/20 text-green-600 dark:text-green-300",
    scoreColor: "text-green-600 dark:text-green-300",
    issues: "2 issues",
    dot: "bg-green-400"
  },
  {
    name: "localrestaurant.lk",
    score: 53,
    status: "Needs Attention",
    statusColor: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300",
    scoreColor: "text-yellow-600 dark:text-yellow-300",
    issues: "8 issues",
    dot: "bg-yellow-400"
  },
  {
    name: "agencyportfolio.com",
    score: 91,
    status: "Excellent",
    statusColor: "bg-blue-500/20 text-blue-600 dark:text-blue-300",
    scoreColor: "text-blue-600 dark:text-blue-300",
    issues: "0 issues",
    dot: "bg-blue-400"
  }
] as const;

function getProgressBarTone(score: number) {
  if (score >= 80) {
    return "bg-green-400";
  }

  if (score >= 60) {
    return "bg-yellow-400";
  }

  return "bg-red-400";
}

export function AgencyDashboardBrowserMockup() {
  return (
    <div className="relative w-full">
      <div className="pointer-events-none absolute inset-x-10 top-12 h-40 rounded-full bg-blue-500/18 blur-3xl sm:inset-x-16 sm:top-16 sm:h-52" />

      <div className="relative overflow-hidden rounded-[1.9rem] border border-slate-200/85 bg-[linear-gradient(180deg,rgba(255,255,255,0.97),rgba(239,246,255,0.98))] shadow-[0_36px_110px_-58px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(14,23,39,0.98),rgba(8,17,31,0.98))] dark:shadow-[0_36px_110px_-58px_rgba(2,6,23,0.95)]">
        <div className="flex items-center gap-3 border-b border-slate-200/80 bg-white/90 px-4 py-3 dark:border-white/10 dark:bg-white/[0.03] sm:px-5">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
          </div>
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-slate-200/80 bg-slate-100/90 px-3 py-2 text-[11px] text-slate-500 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-300">
            <Lock className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">app.trysitepulse.com/dashboard</span>
          </div>
        </div>

        <div className="flex min-h-[480px] bg-[linear-gradient(180deg,rgba(248,250,252,0.92),rgba(241,245,249,0.85))] dark:bg-[linear-gradient(180deg,rgba(6,13,24,0.65),rgba(7,14,25,0.92))] sm:min-h-[520px]">
          <aside className="flex w-14 shrink-0 flex-col items-center gap-3 border-r border-slate-200/80 bg-slate-950 px-2 py-4 dark:border-white/10 sm:w-16 sm:gap-4 sm:px-3 sm:py-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-blue-500 text-sm font-semibold text-white shadow-[0_12px_30px_-18px_rgba(59,130,246,0.9)]">
              S
            </div>
            <div className="mt-2 flex flex-col items-center gap-2.5 text-slate-400">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/10 text-white">
                <LayoutDashboard className="h-4 w-4" />
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/5">
                <Globe className="h-4 w-4" />
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/5">
                <BarChart3 className="h-4 w-4" />
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/5">
                <Bell className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-auto flex flex-col items-center gap-2.5 text-slate-400">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/5">
                <FileText className="h-4 w-4" />
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/5">
                <Settings className="h-4 w-4" />
              </div>
            </div>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col p-3 sm:p-4">
            <div className="flex flex-col gap-3 border-b border-slate-200/80 pb-4 dark:border-white/10 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-blue-700 dark:text-blue-200">
                  <Activity className="h-3.5 w-3.5" />
                  Agency overview
                </div>
                <h3 className="mt-2 font-display text-[1.35rem] font-semibold leading-tight text-slate-950 dark:text-white sm:text-[1.5rem]">
                  Agency Dashboard
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">5 sites monitored - 3 need attention</p>
              </div>
              <button className="inline-flex items-center justify-center gap-2 self-start rounded-2xl bg-blue-500 px-3 py-2 text-sm font-semibold text-white shadow-[0_16px_36px_-24px_rgba(59,130,246,0.85)] transition hover:bg-blue-600">
                <Plus className="h-4 w-4" />
                Add Site
              </button>
            </div>

            <div className="mt-4 space-y-2.5">
              {dashboardSites.map((site) => (
                <div
                  key={site.name}
                  className="grid grid-cols-[auto_minmax(0,1fr)] gap-2 rounded-[1.2rem] border border-slate-200/80 bg-white/88 px-3 py-3 shadow-[0_20px_40px_-34px_rgba(15,23,42,0.18)] dark:border-white/10 dark:bg-white/[0.04] sm:grid-cols-[auto_minmax(0,1.35fr)_auto_auto_minmax(120px,0.9fr)_auto] sm:items-center"
                >
                  <span className={cn("mt-1 h-2.5 w-2.5 rounded-full sm:mt-0", site.dot)} />

                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{site.name}</p>
                    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 sm:hidden">{site.issues}</p>
                  </div>

                  <p className="hidden text-[11px] font-medium text-slate-500 dark:text-slate-400 sm:block">{site.issues}</p>

                  <div className="justify-self-start sm:justify-self-center">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]",
                        site.statusColor
                      )}
                    >
                      {site.status}
                    </span>
                  </div>

                  <div className="col-span-2 flex min-w-0 items-center gap-2 sm:col-span-1">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                      <div
                        className={cn("h-full rounded-full transition-[width] duration-500", getProgressBarTone(site.score))}
                        style={{ width: `${site.score}%` }}
                      />
                    </div>
                    <span className={cn("w-8 text-right text-sm font-semibold", site.scoreColor)}>{site.score}</span>
                  </div>

                  <button className="col-span-2 inline-flex items-center justify-self-start text-[11px] font-semibold text-slate-600 transition hover:text-slate-900 dark:col-span-1 dark:text-slate-300 dark:hover:text-white sm:justify-self-end">
                    Report -&gt;
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-4 grid gap-2 rounded-[1.35rem] border border-slate-200/80 bg-slate-50/92 p-3 dark:border-white/10 dark:bg-white/[0.04] sm:grid-cols-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Avg Health Score</p>
                <p className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">67.6/100</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Reports Sent</p>
                <p className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">23 this month</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Next Scan</p>
                <p className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">6:30 AM tomorrow</p>
              </div>
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute bottom-4 left-4 right-4 sm:left-auto sm:right-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-red-300/35 bg-white/92 px-3 py-2 text-xs font-semibold text-slate-900 shadow-[0_18px_38px_-26px_rgba(15,23,42,0.28)] backdrop-blur dark:border-red-400/20 dark:bg-slate-950/88 dark:text-white">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_0_4px_rgba(239,68,68,0.16)]" />
            Live monitoring active
          </div>
        </div>
      </div>
    </div>
  );
}
