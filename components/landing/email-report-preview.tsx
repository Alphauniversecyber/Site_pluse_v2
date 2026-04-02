import { AlertTriangle, ArrowUpRight, Gauge, ShieldAlert } from "lucide-react";

import { SitePulseLogo } from "@/components/brand/sitepulse-logo";
import { Button } from "@/components/ui/button";

export function EmailReportPreview() {
  return (
    <div className="overflow-hidden rounded-[2rem] border border-slate-300/70 bg-white shadow-[0_30px_80px_-40px_rgba(15,23,42,0.45)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex gap-2">
            <span className="h-4 w-4 rounded-full bg-[#EA4335]" />
            <span className="h-4 w-4 rounded-full bg-[#34A853]" />
          </div>
          <span className="text-sm text-slate-500">Email</span>
        </div>
        <div className="max-w-full rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-500">
          Your Weekly Website Report
        </div>
      </div>

      <div className="grid gap-0 md:grid-cols-[220px_1fr] lg:grid-cols-[260px_1fr]">
        <aside className="hidden border-r border-slate-200 bg-slate-50/70 p-5 md:block">
          <div className="rounded-full border border-slate-200 bg-white px-5 py-4 text-lg font-medium text-slate-700 shadow-sm">
            Inbox
          </div>
          <div className="mt-8 space-y-4">
            {["Reports", "Alerts", "Clients"].map((item) => (
              <div key={item} className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
                {item}
              </div>
            ))}
          </div>
        </aside>

        <div className="bg-white p-4 sm:p-6 md:p-8">
          <div className="rounded-[1.75rem] border border-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-t-[1.75rem] bg-[#1E2F59] px-4 py-5 sm:px-6">
              <SitePulseLogo variant="dark" className="h-10 w-[170px] max-w-full" />
              <span className="text-xs uppercase tracking-[0.24em] text-slate-300">Automated weekly report</span>
            </div>

            <div className="px-4 py-6 sm:px-6 sm:py-8 md:px-10">
              <h3 className="text-center font-display text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                Your Weekly Website Report
              </h3>
              <p className="mt-2 break-all text-center text-lg text-slate-500 sm:text-2xl">clientwebsite.com</p>

              <div className="mt-8 grid gap-3 rounded-[1.7rem] border border-slate-200 px-4 py-4 text-slate-900 sm:px-5 md:grid-cols-2 xl:grid-cols-4">
                {[
                  ["Performance", "91", "91%"],
                  ["SEO", "85", "85%"],
                  ["Accessibility", "72", "72%"],
                  ["Best Practices", "88", "88%"]
                ].map(([label, value, width]) => (
                  <div key={label} className="border-slate-200 md:pr-3 xl:border-r last:xl:border-r-0">
                    <p className="text-sm text-slate-500">{label}</p>
                    <div className="mt-2 flex items-center gap-3">
                      <span className="h-5 w-5 rounded-full border-4 border-emerald-500" />
                      <span className="text-4xl font-semibold tracking-tight sm:text-5xl">{value}</span>
                    </div>
                    <div className="mt-4 h-2 rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400" style={{ width }} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-10 grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
                <div>
                  <h4 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">What changed this week</h4>
                  <div className="mt-5 space-y-4">
                    <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                      <span className="rounded-xl bg-emerald-600 px-3 py-1 text-lg font-semibold text-white">+3</span>
                      <p className="text-base text-slate-700 sm:text-lg">Performance issues resolved</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
                      <span className="rounded-xl bg-rose-600 px-3 py-1 text-lg font-semibold text-white">-5</span>
                      <p className="text-base text-slate-700 sm:text-lg">New accessibility problems detected</p>
                    </div>
                  </div>

                  <Button className="mt-6 rounded-2xl px-8 py-6 text-lg">View Full Dashboard</Button>
                </div>

                <div className="border-t border-slate-200 pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
                  <h4 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Top Issues</h4>
                  <div className="mt-5 space-y-4">
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
                        <div key={item.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="flex items-start gap-4">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
                              <Icon className="h-5 w-5" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-slate-900">{item.title}</p>
                                <ArrowUpRight className="h-4 w-4 text-blue-600" />
                              </div>
                              <p className="mt-2 text-base leading-7 text-slate-600">{item.body}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="mt-10 border-t border-slate-200 pt-6 text-center text-sm text-slate-500">
                You received this email because you are subscribed to SitePulse.{" "}
                <span className="text-blue-600">Unsubscribe</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
