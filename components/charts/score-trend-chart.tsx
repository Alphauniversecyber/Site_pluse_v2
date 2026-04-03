"use client";

import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { ScanResult } from "@/types";

type TrendDatum = {
  date: string;
  performance: number;
  seo: number;
  accessibility: number;
};

const trendSeries = [
  { key: "performance", label: "Performance", stroke: "#60A5FA", fill: "#3B82F6" },
  { key: "seo", label: "SEO", stroke: "#34D399", fill: "#10B981" },
  { key: "accessibility", label: "Accessibility", stroke: "#FBBF24", fill: "#F59E0B" }
] as const;

function TrendTooltip({
  active,
  label,
  payload
}: {
  active?: boolean;
  label?: string;
  payload?: Array<{ color?: string; name?: string; value?: number }>;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="min-w-[12rem] rounded-[1.25rem] border border-white/10 bg-[#081121]/95 px-4 py-3 shadow-[0_24px_60px_-28px_rgba(59,130,246,0.35)] backdrop-blur-xl">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <div className="mt-3 space-y-2">
        {payload.map((entry) => (
          <div key={entry.name} className="flex items-center justify-between gap-4 text-sm">
            <div className="flex items-center gap-2.5 text-slate-300">
              <span
                className="h-2.5 w-2.5 rounded-full shadow-[0_0_12px_rgba(96,165,250,0.4)]"
                style={{ backgroundColor: entry.color ?? "#60A5FA" }}
              />
              <span>{entry.name}</span>
            </div>
            <span className="font-semibold text-white">{entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ScoreTrendChart({ scans }: { scans: ScanResult[] }) {
  const data: TrendDatum[] = scans
    .slice()
    .reverse()
    .map((scan) => ({
      date: new Date(scan.scanned_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric"
      }),
      performance: scan.performance_score,
      seo: scan.seo_score,
      accessibility: scan.accessibility_score
    }));

  const allValues = data.flatMap((entry) => [entry.performance, entry.seo, entry.accessibility]);
  const chartFloor = allValues.length ? Math.max(0, Math.floor(Math.min(...allValues) / 10) * 10 - 10) : 0;
  const latest = data[data.length - 1];

  return (
    <div className="relative overflow-hidden rounded-[1.75rem] border border-white/8 bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(15,23,42,0.76))] p-4 shadow-[0_24px_70px_-34px_rgba(15,23,42,0.82),0_0_0_1px_rgba(96,165,250,0.06)] sm:p-5">
      <div className="pointer-events-none absolute inset-px rounded-[1.65rem] border border-white/6" />
      <div className="pointer-events-none absolute inset-x-5 top-0 h-24 rounded-full bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.18),transparent_72%)] blur-2xl" />

      <div className="relative flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-wrap gap-2.5">
            {trendSeries.map((series) => (
              <div
                key={series.key}
                className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-2 text-xs text-slate-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="h-2.5 w-2.5 rounded-full shadow-[0_0_14px_rgba(96,165,250,0.38)]"
                    style={{ backgroundColor: series.stroke }}
                  />
                  <span className="font-medium tracking-[0.08em] text-slate-300">{series.label}</span>
                  <span className="font-semibold text-white">
                    {latest ? latest[series.key] : "--"}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Latest 30-day signal</p>
        </div>

        <div className="h-[240px] w-full sm:h-[280px] lg:h-[312px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={data}
              margin={{
                top: 12,
                right: 10,
                left: -12,
                bottom: 4
              }}
            >
              <defs>
                <linearGradient id="score-trend-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.28} />
                  <stop offset="72%" stopColor="#3B82F6" stopOpacity={0.06} />
                  <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
                <filter id="score-trend-glow" x="-40%" y="-40%" width="180%" height="180%">
                  <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#3B82F6" floodOpacity="0.32" />
                </filter>
              </defs>

              <CartesianGrid stroke="rgba(148,163,184,0.12)" strokeDasharray="4 8" vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                minTickGap={18}
                tickMargin={12}
                stroke="#64748B"
                tick={{ fontSize: 11, fill: "#94A3B8" }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={34}
                domain={[chartFloor, 100]}
                tickMargin={10}
                stroke="#64748B"
                tick={{ fontSize: 11, fill: "#94A3B8" }}
              />
              <Tooltip
                cursor={{ stroke: "rgba(96,165,250,0.22)", strokeDasharray: "4 8" }}
                wrapperStyle={{ outline: "none" }}
                content={<TrendTooltip />}
              />

              <Area
                type="monotone"
                dataKey="performance"
                stroke="none"
                fill="url(#score-trend-fill)"
                fillOpacity={1}
                isAnimationActive={false}
              />

              <Line
                type="monotone"
                dataKey="performance"
                name="Performance"
                stroke="#60A5FA"
                strokeWidth={3}
                filter="url(#score-trend-glow)"
                dot={{ r: 0 }}
                activeDot={{ r: 5, fill: "#DBEAFE", stroke: "#60A5FA", strokeWidth: 3 }}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="seo"
                name="SEO"
                stroke="#34D399"
                strokeWidth={2.25}
                strokeOpacity={0.96}
                dot={{ r: 0 }}
                activeDot={{ r: 4, fill: "#D1FAE5", stroke: "#34D399", strokeWidth: 2.5 }}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="accessibility"
                name="Accessibility"
                stroke="#FBBF24"
                strokeWidth={2.25}
                strokeOpacity={0.94}
                dot={{ r: 0 }}
                activeDot={{ r: 4, fill: "#FEF3C7", stroke: "#FBBF24", strokeWidth: 2.5 }}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
