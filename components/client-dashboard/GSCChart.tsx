"use client";

import { Area, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { GscDailyPoint } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";

function TrafficTooltip({
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
    <div className="rounded-2xl border border-white/10 bg-[#08101f]/95 px-4 py-3 shadow-[0_24px_56px_-28px_rgba(15,23,42,0.92)] backdrop-blur-xl">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <div className="mt-3 space-y-2">
        {payload.map((entry) => (
          <div key={entry.name} className="flex items-center justify-between gap-4 text-sm">
            <div className="flex items-center gap-2 text-slate-300">
              <span
                className="h-2.5 w-2.5 rounded-full"
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

export function GSCChart({
  data,
  variant,
  loading
}: {
  data: GscDailyPoint[];
  variant: "traffic" | "position";
  loading?: boolean;
}) {
  const title = variant === "traffic" ? "Clicks + Impressions" : "Average Position Trend";
  const description =
    variant === "traffic"
      ? "Search visibility over the last 28 days."
      : "Lower positions are better, so the axis is inverted.";
  const positionValues = data.map((point) => point.position).filter((value) => value > 0);
  const positionDomain = positionValues.length
    ? [Math.ceil(Math.max(...positionValues) + 1), Math.floor(Math.min(...positionValues) - 1)]
    : [24, 8];

  return (
    <div className="relative rounded-[1.8rem] border border-white/10 bg-white/[0.05] p-5 shadow-[0_24px_64px_-36px_rgba(15,23,42,0.72)] backdrop-blur-xl">
      {loading ? (
        <div className="absolute right-5 top-5 flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2">
          <Skeleton className="h-2 w-14 bg-white/15" />
          <Skeleton className="h-2 w-10 bg-white/15" />
        </div>
      ) : null}

      <div className="mb-5 space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
          {title}
        </p>
        <p className="text-sm text-slate-400">{description}</p>
      </div>

      <div className="h-[290px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{
              top: 12,
              right: variant === "traffic" ? 18 : 8,
              left: -14,
              bottom: 4
            }}
          >
            <defs>
              <linearGradient id={`gsc-fill-${variant}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#38BDF8" stopOpacity={0.24} />
                <stop offset="100%" stopColor="#38BDF8" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid stroke="rgba(148,163,184,0.16)" strokeDasharray="4 8" vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              minTickGap={14}
              tick={{ fill: "#94A3B8", fontSize: 11 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={36}
              tick={{ fill: "#94A3B8", fontSize: 11 }}
              domain={variant === "traffic" ? [0, "dataMax + 40"] : positionDomain}
              reversed={variant === "position"}
            />
            {variant === "traffic" ? (
              <YAxis
                yAxisId="impressions"
                orientation="right"
                tickLine={false}
                axisLine={false}
                width={44}
                tick={{ fill: "#94A3B8", fontSize: 11 }}
              />
            ) : null}
            <Tooltip
              cursor={{ stroke: "rgba(96,165,250,0.22)", strokeDasharray: "4 8" }}
              wrapperStyle={{ outline: "none" }}
              content={<TrafficTooltip />}
            />

            {variant === "traffic" ? (
              <>
                <Area
                  type="monotone"
                  dataKey="clicks"
                  stroke="none"
                  fill={`url(#gsc-fill-${variant})`}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="clicks"
                  name="Clicks"
                  stroke="#38BDF8"
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 5, fill: "#E0F2FE", stroke: "#38BDF8", strokeWidth: 2 }}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="impressions"
                  yAxisId="impressions"
                  name="Impressions"
                  stroke="#A78BFA"
                  strokeWidth={2.25}
                  dot={false}
                  activeDot={{ r: 4, fill: "#EDE9FE", stroke: "#A78BFA", strokeWidth: 2 }}
                  isAnimationActive={false}
                />
              </>
            ) : (
              <Line
                type="monotone"
                dataKey="position"
                name="Avg Position"
                stroke="#FBBF24"
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 5, fill: "#FEF3C7", stroke: "#FBBF24", strokeWidth: 2 }}
                isAnimationActive={false}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
