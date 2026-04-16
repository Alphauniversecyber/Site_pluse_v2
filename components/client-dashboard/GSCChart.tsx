"use client";

import { Area, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { GscDailyPoint } from "@/types";
import { useTheme } from "@/components/theme/theme-provider";
import { Skeleton } from "@/components/ui/skeleton";

function ChartEmptyState({
  title,
  body
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-border bg-background/70 px-6 text-center">
      <p className="font-display text-lg font-semibold text-foreground">{title}</p>
      <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{body}</p>
    </div>
  );
}

function TrafficTooltip({
  active,
  label,
  payload,
  isDark
}: {
  active?: boolean;
  label?: string;
  payload?: Array<{ color?: string; name?: string; value?: number }>;
  isDark: boolean;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div
      className="rounded-2xl border px-4 py-3 shadow-[0_24px_56px_-28px_rgba(15,23,42,0.28)] backdrop-blur-xl"
      style={{
        borderColor: isDark ? "rgba(148,163,184,0.18)" : "rgba(148,163,184,0.28)",
        backgroundColor: isDark ? "rgba(15,23,42,0.94)" : "rgba(255,255,255,0.96)"
      }}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <div className="mt-3 space-y-2">
        {payload.map((entry) => (
          <div key={entry.name} className="flex items-center justify-between gap-4 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: entry.color ?? "#60A5FA" }}
              />
              <span>{entry.name}</span>
            </div>
            <span className="font-semibold text-foreground">{entry.value}</span>
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
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const positionValues = data.map((point) => point.position).filter((value) => value > 0);
  const positionDomain = positionValues.length
    ? [Math.ceil(Math.max(...positionValues) + 1), Math.floor(Math.min(...positionValues) - 1)]
    : [24, 8];
  const axisColor = isDark ? "#94A3B8" : "#64748B";
  const gridColor = isDark ? "rgba(148,163,184,0.16)" : "rgba(148,163,184,0.22)";

  if (!data.length) {
    return (
      <div className="relative rounded-[1.8rem] border border-border/70 bg-card/90 p-5 shadow-[0_30px_80px_-48px_rgba(15,23,42,0.38)] backdrop-blur-xl">
        <div className="mb-5 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            {title}
          </p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="h-[290px] w-full">
          <ChartEmptyState
            title={variant === "traffic" ? "No search trend yet" : "No ranking history yet"}
            body="This chart will populate after Search Console returns live data for this site."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="relative rounded-[1.8rem] border border-border/70 bg-card/90 p-5 shadow-[0_30px_80px_-48px_rgba(15,23,42,0.38)] backdrop-blur-xl">
      {loading ? (
        <div className="absolute right-5 top-5 flex items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-2">
          <Skeleton className="h-2 w-14 bg-muted" />
          <Skeleton className="h-2 w-10 bg-muted" />
        </div>
      ) : null}

      <div className="mb-5 space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          {title}
        </p>
        <p className="text-sm text-muted-foreground">{description}</p>
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

            <CartesianGrid stroke={gridColor} strokeDasharray="4 8" vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              minTickGap={14}
              tick={{ fill: axisColor, fontSize: 11 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={36}
              tick={{ fill: axisColor, fontSize: 11 }}
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
                tick={{ fill: axisColor, fontSize: 11 }}
              />
            ) : null}
            <Tooltip
              cursor={{ stroke: "rgba(96,165,250,0.22)", strokeDasharray: "4 8" }}
              wrapperStyle={{ outline: "none" }}
              content={<TrafficTooltip isDark={isDark} />}
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
