"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import type { CountryBreakdownPoint, DeviceBreakdownPoint, GaDailyPoint } from "@/types";
import { useTheme } from "@/components/theme/theme-provider";
import { Skeleton } from "@/components/ui/skeleton";

const PIE_COLORS = ["#38BDF8", "#34D399", "#FBBF24", "#F87171", "#A78BFA"];

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

function ChartTooltip({
  active,
  label,
  payload,
  isDark
}: {
  active?: boolean;
  label?: string;
  payload?: Array<{ name?: string; value?: number; payload?: { share?: number } }>;
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
      {label ? (
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      ) : null}
      <div className="mt-2 space-y-2">
        {payload.map((entry) => (
          <div key={`${entry.name}-${entry.value}`} className="flex items-center justify-between gap-4 text-sm">
            <span className="text-muted-foreground">{entry.name}</span>
            <span className="font-semibold text-foreground">
              {entry.value}
              {typeof entry.payload?.share === "number" ? ` (${entry.payload.share}%)` : ""}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function GAChart({
  variant,
  daily,
  devices,
  countries,
  loading
}: {
  variant: "sessions" | "device" | "country";
  daily?: GaDailyPoint[];
  devices?: DeviceBreakdownPoint[];
  countries?: CountryBreakdownPoint[];
  loading?: boolean;
}) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const axisColor = isDark ? "#94A3B8" : "#64748B";
  const pieStroke = isDark ? "rgba(15,23,42,0.45)" : "rgba(255,255,255,0.9)";

  if (variant === "sessions") {
    if (!daily?.length) {
      return (
        <div className="h-24 w-full">
          <ChartEmptyState
            title="Waiting for live analytics"
            body="Sessions will appear here after GA4 returns the first successful sync."
          />
        </div>
      );
    }

    return (
      <div className="relative h-24 w-full">
        {loading ? (
          <div className="absolute right-0 top-0 z-10 flex items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-2">
            <Skeleton className="h-2 w-12 bg-muted" />
            <Skeleton className="h-2 w-8 bg-muted" />
          </div>
        ) : null}
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={daily}
            margin={{
              top: 6,
              right: 0,
              left: 0,
              bottom: 0
            }}
          >
            <defs>
              <linearGradient id="ga-sessions-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#38BDF8" stopOpacity={0.32} />
                <stop offset="100%" stopColor="#38BDF8" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Tooltip content={<ChartTooltip isDark={isDark} />} />
            <Area
              type="monotone"
              dataKey="sessions"
              stroke="#38BDF8"
              strokeWidth={2.5}
              fill="url(#ga-sessions-fill)"
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (variant === "device") {
    const total = (devices ?? []).reduce((sum, item) => sum + item.sessions, 0);

    if (!devices?.length) {
      return (
        <div className="h-[300px] w-full">
          <ChartEmptyState
            title="No device mix yet"
            body="Device breakdown will show up here once enough GA4 session data has synced."
          />
        </div>
      );
    }

    return (
      <div className="relative h-[300px] w-full">
        {loading ? (
          <div className="absolute right-0 top-0 z-10 flex items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-2">
            <Skeleton className="h-2 w-12 bg-muted" />
            <Skeleton className="h-2 w-8 bg-muted" />
          </div>
        ) : null}
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={devices}
              dataKey="sessions"
              nameKey="device"
              innerRadius={66}
              outerRadius={96}
              paddingAngle={4}
              stroke={pieStroke}
            >
              {(devices ?? []).map((entry, index) => (
                <Cell key={entry.device} fill={PIE_COLORS[index % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip isDark={isDark} />} />
            <text
              x="50%"
              y="48%"
              textAnchor="middle"
              dominantBaseline="middle"
              fill={isDark ? "#E2E8F0" : "#0F172A"}
              className="text-sm font-medium"
            >
              Sessions
            </text>
            <text
              x="50%"
              y="57%"
              textAnchor="middle"
              dominantBaseline="middle"
              fill={isDark ? "#FFFFFF" : "#0F172A"}
              className="text-3xl font-semibold"
            >
              {total.toLocaleString()}
            </text>
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (!countries?.length) {
    return (
      <div className="h-[300px] w-full">
        <ChartEmptyState
          title="No country data yet"
          body="Top country traffic will appear here after GA4 has enough live data to report."
        />
      </div>
    );
  }

  return (
    <div className="relative h-[300px] w-full">
      {loading ? (
        <div className="absolute right-0 top-0 z-10 flex items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-2">
          <Skeleton className="h-2 w-12 bg-muted" />
          <Skeleton className="h-2 w-8 bg-muted" />
        </div>
      ) : null}
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={countries}
          layout="vertical"
          margin={{
            top: 6,
            right: 12,
            left: 24,
            bottom: 6
          }}
        >
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="country"
            axisLine={false}
            tickLine={false}
            tick={{ fill: axisColor, fontSize: 12 }}
            width={90}
          />
          <Tooltip content={<ChartTooltip isDark={isDark} />} />
          <Bar dataKey="sessions" radius={[999, 999, 999, 999]} fill="#34D399" isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
