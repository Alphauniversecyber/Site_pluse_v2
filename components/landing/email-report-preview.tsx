import { AlertTriangle, ArrowUpRight, Gauge, ShieldAlert } from "lucide-react";

import { SitePulseLogo } from "@/components/brand/sitepulse-logo";

export function EmailReportPreview() {
  return (
    <div className="relative origin-top overflow-hidden rounded-[1.7rem] border border-slate-300/70 bg-white shadow-[0_28px_70px_-42px_rgba(15,23,42,0.34)] transition duration-300 md:scale-[0.97] lg:[transform:perspective(1400px)_rotateX(1.2deg)_scale(0.95)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:px-5">
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

      <div className="grid gap-0 md:grid-cols-[150px_1fr] lg:grid-cols-[180px_1fr]">
        <aside className="hidden border-r border-slate-200 bg-slate-50/70 p-3.5 md:block">
          <div className="rounded-full border border-slate-200 bg-white px-4 py-3 text-base font-medium text-slate-700 shadow-sm">
            Inbox
          </div>
          <div className="mt-5 space-y-2.5">
            {["Reports", "Alerts"].map((item) => (
              <div key={item} className="rounded-2xl bg-white px-4 py-2 text-sm text-slate-500 shadow-sm">
                {item}
              </div>
            ))}
          </div>
        </aside>

        <div className="bg-white p-3.5 sm:p-4 md:p-5">
          <div className="relative overflow-hidden rounded-[1.45rem] border border-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-t-[1.45rem] bg-[#1E2F59] px-4 py-3.5 sm:px-5">
              <SitePulseLogo variant="dark" className="h-9 w-[156px] max-w-full" />
              <span className="text-xs uppercase tracking-[0.24em] text-slate-300">Automated weekly report</span>
            </div>

            <div className="px-4 py-4 sm:px-5 sm:py-5 md:px-6">
              <h3 className="text-center font-display text-xl font-semibold tracking-tight text-slate-900 sm:text-[1.7rem]">
                Your Weekly Website Report
              </h3>
              <p className="mt-1.5 break-all text-center text-sm text-slate-500 sm:text-lg">clientwebsite.com</p>

              <div className="mt-5 grid gap-2.5 rounded-[1.25rem] border border-slate-200 px-3 py-3 text-slate-900 md:grid-cols-2 xl:grid-cols-4">
                {[
                  ["Performance", "91", "91%"],
                  ["SEO", "85", "85%"],
                  ["Accessibility", "72", "72%"],
                  ["Best Practices", "88", "88%"]
                ].map(([label, value, width]) => (
                  <div key={label} className="border-slate-200 md:pr-2.5 xl:border-r last:xl:border-r-0">
                    <p className="text-xs text-slate-500">{label}</p>
                    <div className="mt-2 flex items-center gap-2.5">
                      <span className="h-4 w-4 rounded-full border-[3px] border-emerald-500" />
                      <span className="text-[1.7rem] font-semibold tracking-tight sm:text-[2rem]">{value}</span>
                    </div>
                    <div className="mt-2.5 h-1.5 rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400" style={{ width }} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5">
                <h4 className="text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">Top Issues</h4>
                <div className="mt-3 space-y-3">
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
                      <div key={item.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <div className="flex items-start gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
                            <Icon className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-slate-900">{item.title}</p>
                              <ArrowUpRight className="h-4 w-4 text-blue-600" />
                            </div>
                            <p className="mt-1.5 text-sm leading-6 text-slate-600">{item.body}</p>
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
