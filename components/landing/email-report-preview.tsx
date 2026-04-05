import { AlertTriangle, ArrowUpRight, Gauge, ShieldAlert } from "lucide-react";

import { SitePulseLogo } from "@/components/brand/sitepulse-logo";
import { cn } from "@/lib/utils";

export function EmailReportPreview({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={cn(
        "relative origin-top overflow-hidden rounded-[1.7rem] border border-slate-300/70 bg-white shadow-[0_28px_70px_-42px_rgba(15,23,42,0.34)] transition duration-300",
        compact
          ? "md:scale-[0.9] lg:[transform:perspective(1400px)_rotateX(1deg)_scale(0.83)] xl:[transform:perspective(1400px)_rotateX(0.9deg)_scale(0.86)]"
          : "md:scale-[0.95] lg:[transform:perspective(1400px)_rotateX(1.2deg)_scale(0.9)] xl:[transform:perspective(1400px)_rotateX(1deg)_scale(0.92)]"
      )}
    >
      <div className={cn("flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50", compact ? "px-3.5 py-2.5 sm:px-4" : "px-4 py-3 sm:px-5")}>
        <div className="flex items-center gap-3">
          <div className="flex gap-2">
            <span className="h-3 w-3 rounded-full bg-[#EA4335]" />
            <span className="h-3 w-3 rounded-full bg-[#34A853]" />
          </div>
          <span className="text-sm text-slate-500">Email</span>
        </div>
        <div className="max-w-full rounded-full bg-slate-100 px-4 py-1.5 text-sm text-slate-500">
          Your Weekly Website Report
        </div>
      </div>

      <div className={cn("grid gap-0", compact ? "md:grid-cols-[132px_1fr] lg:grid-cols-[156px_1fr]" : "md:grid-cols-[150px_1fr] lg:grid-cols-[180px_1fr]")}>
        <aside className={cn("hidden border-r border-slate-200 bg-slate-50/70 md:block", compact ? "p-3" : "p-3.5")}>
          <div className={cn("rounded-full border border-slate-200 bg-white font-medium text-slate-700 shadow-sm", compact ? "px-4 py-2.5 text-[15px]" : "px-4 py-3 text-base")}>
            Inbox
          </div>
          <div className={cn(compact ? "mt-4 space-y-2" : "mt-5 space-y-2.5")}>
            {["Reports", "Alerts"].map((item) => (
              <div key={item} className={cn("rounded-2xl bg-white text-slate-500 shadow-sm", compact ? "px-4 py-2 text-[13px]" : "px-4 py-2 text-sm")}>
                {item}
              </div>
            ))}
          </div>
        </aside>

        <div className={cn("bg-white", compact ? "p-3 sm:p-3.5 md:p-4" : "p-3.5 sm:p-4 md:p-5")}>
          <div className="relative overflow-hidden rounded-[1.45rem] border border-slate-200">
            <div className={cn("flex flex-wrap items-center justify-between gap-3 rounded-t-[1.45rem] bg-[#1E2F59]", compact ? "px-3.5 py-3 sm:px-4" : "px-4 py-3.5 sm:px-5")}>
              <SitePulseLogo variant="dark" className={cn("max-w-full", compact ? "h-8 w-[138px]" : "h-9 w-[156px]")} />
              <span className={cn("uppercase tracking-[0.24em] text-slate-300", compact ? "text-[10px]" : "text-xs")}>Automated weekly report</span>
            </div>

            <div className={cn(compact ? "px-3.5 py-3.5 sm:px-4 sm:py-4 md:px-5" : "px-4 py-4 sm:px-5 sm:py-5 md:px-6")}>
              <h3 className={cn("text-center font-display font-semibold tracking-tight text-slate-900", compact ? "text-lg sm:text-[1.45rem]" : "text-xl sm:text-[1.7rem]")}>
                Your Weekly Website Report
              </h3>
              <p className={cn("mt-1.5 break-all text-center text-slate-500", compact ? "text-sm sm:text-base" : "text-sm sm:text-lg")}>clientwebsite.com</p>

              <div className={cn("grid gap-2.5 rounded-[1.25rem] border border-slate-200 text-slate-900 md:grid-cols-2 xl:grid-cols-4", compact ? "mt-4 px-2.5 py-2.5" : "mt-5 px-3 py-3")}>
                {[
                  ["Performance", "91", "91%"],
                  ["SEO", "85", "85%"],
                  ["Accessibility", "72", "72%"],
                  ["Best Practices", "88", "88%"]
                ].map(([label, value, width]) => (
                  <div key={label} className={cn("border-slate-200 xl:border-r last:xl:border-r-0", compact ? "md:pr-2 xl:pr-2.5" : "md:pr-2.5")}>
                    <p className="text-xs text-slate-500">{label}</p>
                    <div className={cn("flex items-center", compact ? "mt-1.5 gap-2" : "mt-2 gap-2.5")}>
                      <span className={cn("rounded-full border-[3px] border-emerald-500", compact ? "h-3.5 w-3.5" : "h-4 w-4")} />
                      <span className={cn("font-semibold tracking-tight", compact ? "text-[1.45rem] sm:text-[1.7rem]" : "text-[1.7rem] sm:text-[2rem]")}>{value}</span>
                    </div>
                    <div className={cn("rounded-full bg-slate-100", compact ? "mt-2 h-1.5" : "mt-2.5 h-1.5")}>
                      <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400" style={{ width }} />
                    </div>
                  </div>
                ))}
              </div>

              <div className={compact ? "mt-4" : "mt-5"}>
                <h4 className={cn("font-semibold tracking-tight text-slate-900", compact ? "text-[1.05rem] sm:text-lg" : "text-lg sm:text-xl")}>Top Issues</h4>
                <div className={cn(compact ? "mt-2.5 space-y-2.5" : "mt-3 space-y-3")}>
                  {[
                    {
                      icon: Gauge,
                      title: "Loading Speed",
                      body: "Your homepage is taking 3.1s to load, over the 2.5s recommendation."
                    },
                    {
                      icon: ShieldAlert,
                      title: "Missing Image Alt Texts",
                      body: "6 images are missing alt attributes, which hurts accessibility confidence."
                    },
                    {
                      icon: AlertTriangle,
                      title: "Duplicate Meta Descriptions",
                      body: "4 pages have duplicate meta descriptions, which weakens technical SEO quality."
                    }
                  ].map((item) => {
                    const Icon = item.icon;

                    return (
                      <div key={item.title} className={cn("rounded-2xl border border-slate-200 bg-slate-50", compact ? "p-2.5" : "p-3")}>
                        <div className={cn("flex items-start", compact ? "gap-2.5" : "gap-3")}>
                          <div className={cn("flex shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-600", compact ? "h-8 w-8" : "h-9 w-9")}>
                            <Icon className={cn(compact ? "h-3.5 w-3.5" : "h-4 w-4")} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className={cn("font-semibold text-slate-900", compact ? "text-[15px]" : "")}>{item.title}</p>
                              <ArrowUpRight className="h-4 w-4 text-blue-600" />
                            </div>
                            <p className={cn("mt-1.5 text-slate-600", compact ? "text-[13px] leading-5" : "text-sm leading-6")}>{item.body}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white via-white/92 to-transparent" />
          </div>
        </div>
      </div>
    </div>
  );
}
