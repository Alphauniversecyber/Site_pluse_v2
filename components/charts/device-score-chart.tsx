"use client";

import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { ScanResult } from "@/types";

type DeviceDatum = {
  device: string;
  performance: number;
  accessibility: number;
  seo: number;
};

const deviceSeries = [
  { key: "performance", label: "Performance", fill: "url(#device-performance-bar)", accent: "#60A5FA" },
  { key: "accessibility", label: "Accessibility", fill: "url(#device-accessibility-bar)", accent: "#34D399" },
  { key: "seo", label: "SEO", fill: "url(#device-seo-bar)", accent: "#FBBF24" }
] as const;

function DeviceTooltip({
  active,
  payload,
  label
}: {
  active?: boolean;
  payload?: Array<{ color?: string; name?: string; value?: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const entry = payload[0];

  return (
    <div className="min-w-[11rem] rounded-[1.25rem] border border-white/10 bg-[#081121]/95 px-4 py-3 shadow-[0_24px_60px_-28px_rgba(59,130,246,0.35)] backdrop-blur-xl">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <div className="mt-3 flex items-center justify-between gap-4 text-sm">
        <div className="flex items-center gap-2.5 text-slate-300">
          <span
            className="h-2.5 w-2.5 rounded-full shadow-[0_0_12px_rgba(96,165,250,0.34)]"
            style={{ backgroundColor: entry.color ?? "#60A5FA" }}
          />
          <span>{entry.name}</span>
        </div>
        <span className="font-semibold text-white">{entry.value}</span>
      </div>
    </div>
  );
}

function ValueLabel(props: {
  x?: number;
  y?: number;
  width?: number;
  value?: number | string;
}) {
  if (
    props.x === undefined ||
    props.y === undefined ||
    props.width === undefined ||
    props.value === undefined
  ) {
    return null;
  }

  return (
    <text
      x={props.x + props.width / 2}
      y={props.y - 10}
      textAnchor="middle"
      fill="#E2E8F0"
      fontSize="11"
      fontWeight="600"
      letterSpacing="0.08em"
    >
      {props.value}
    </text>
  );
}

export function DeviceScoreChart({ scan }: { scan: ScanResult }) {
  const data: DeviceDatum[] = [
    {
      device: "Mobile",
      performance: scan.mobile_snapshot?.performance_score ?? scan.performance_score,
      accessibility: scan.mobile_snapshot?.accessibility_score ?? scan.accessibility_score,
      seo: scan.mobile_snapshot?.seo_score ?? scan.seo_score
    },
    {
      device: "Desktop",
      performance: scan.desktop_snapshot?.performance_score ?? scan.performance_score,
      accessibility: scan.desktop_snapshot?.accessibility_score ?? scan.accessibility_score,
      seo: scan.desktop_snapshot?.seo_score ?? scan.seo_score
    }
  ];

  const mobilePerformance = data[0]?.performance ?? 0;
  const desktopPerformance = data[1]?.performance ?? 0;
  const comparison =
    desktopPerformance === mobilePerformance
      ? "Mobile and desktop are performing evenly."
      : desktopPerformance > mobilePerformance
        ? `Desktop leads mobile by ${desktopPerformance - mobilePerformance} points.`
        : `Mobile leads desktop by ${mobilePerformance - desktopPerformance} points.`;

  return (
    <div className="relative overflow-hidden rounded-[1.75rem] border border-white/8 bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(15,23,42,0.76))] p-4 shadow-[0_24px_70px_-34px_rgba(15,23,42,0.82),0_0_0_1px_rgba(96,165,250,0.06)] sm:p-5">
      <div className="pointer-events-none absolute inset-px rounded-[1.65rem] border border-white/6" />
      <div className="pointer-events-none absolute right-0 top-0 h-28 w-40 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.18),transparent_72%)] blur-2xl" />

      <div className="relative flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-wrap gap-2.5">
            {deviceSeries.map((series) => (
              <div
                key={series.key}
                className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-2 text-xs text-slate-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="h-2.5 w-2.5 rounded-full shadow-[0_0_14px_rgba(96,165,250,0.36)]"
                    style={{ backgroundColor: series.accent }}
                  />
                  <span className="font-medium tracking-[0.08em] text-slate-300">{series.label}</span>
                </div>
              </div>
            ))}
          </div>
          <p className="max-w-[18rem] text-right text-xs leading-5 text-slate-400">{comparison}</p>
        </div>

        <div className="h-[240px] w-full sm:h-[280px] lg:h-[312px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{
                top: 22,
                right: 8,
                left: -8,
                bottom: 8
              }}
              barCategoryGap="34%"
              barGap={10}
            >
              <defs>
                <linearGradient id="device-performance-bar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#60A5FA" />
                  <stop offset="100%" stopColor="#2563EB" />
                </linearGradient>
                <linearGradient id="device-accessibility-bar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#34D399" />
                  <stop offset="100%" stopColor="#059669" />
                </linearGradient>
                <linearGradient id="device-seo-bar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FBBF24" />
                  <stop offset="100%" stopColor="#D97706" />
                </linearGradient>
              </defs>

              <CartesianGrid stroke="rgba(148,163,184,0.12)" strokeDasharray="4 8" vertical={false} />
              <XAxis
                dataKey="device"
                tickLine={false}
                axisLine={false}
                tickMargin={14}
                stroke="#64748B"
                tick={{ fontSize: 12, fill: "#CBD5E1", fontWeight: 600 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                domain={[0, 100]}
                width={34}
                tickMargin={10}
                stroke="#64748B"
                tick={{ fontSize: 11, fill: "#94A3B8" }}
              />
              <Tooltip
                shared={false}
                cursor={false}
                wrapperStyle={{ outline: "none" }}
                content={<DeviceTooltip />}
              />

              {deviceSeries.map((series) => (
                <Bar
                  key={series.key}
                  dataKey={series.key}
                  name={series.label}
                  fill={series.fill}
                  radius={[12, 12, 4, 4]}
                  maxBarSize={26}
                  isAnimationActive={false}
                  activeBar={{
                    fill: series.accent,
                    stroke: "rgba(255,255,255,0.18)",
                    strokeWidth: 1,
                    filter: "drop-shadow(0 0 12px rgba(96,165,250,0.35))"
                  }}
                >
                  <LabelList dataKey={series.key} content={<ValueLabel />} />
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
