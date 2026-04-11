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
import { Skeleton } from "@/components/ui/skeleton";

const PIE_COLORS = ["#38BDF8", "#34D399", "#FBBF24", "#F87171", "#A78BFA"];

function DarkTooltip({
  active,
  label,
  payload
}: {
  active?: boolean;
  label?: string;
  payload?: Array<{ name?: string; value?: number; payload?: { share?: number } }>;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-[#08101f]/95 px-4 py-3 shadow-[0_24px_56px_-28px_rgba(15,23,42,0.92)] backdrop-blur-xl">
      {label ? <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p> : null}
      <div className="mt-2 space-y-2">
        {payload.map((entry) => (
          <div key={`${entry.name}-${entry.value}`} className="flex items-center justify-between gap-4 text-sm">
            <span className="text-slate-300">{entry.name}</span>
            <span className="font-semibold text-white">
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
  if (variant === "sessions") {
    return (
      <div className="relative h-24 w-full">
        {loading ? (
          <div className="absolute right-0 top-0 z-10 flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-2">
            <Skeleton className="h-2 w-12 bg-white/15" />
            <Skeleton className="h-2 w-8 bg-white/15" />
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
            <Tooltip content={<DarkTooltip />} />
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

    return (
      <div className="relative h-[300px] w-full">
        {loading ? (
          <div className="absolute right-0 top-0 z-10 flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-2">
            <Skeleton className="h-2 w-12 bg-white/15" />
            <Skeleton className="h-2 w-8 bg-white/15" />
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
              stroke="rgba(15,23,42,0.45)"
            >
              {(devices ?? []).map((entry, index) => (
                <Cell key={entry.device} fill={PIE_COLORS[index % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<DarkTooltip />} />
            <text x="50%" y="48%" textAnchor="middle" dominantBaseline="middle" className="fill-white text-sm font-medium">
              Sessions
            </text>
            <text x="50%" y="57%" textAnchor="middle" dominantBaseline="middle" className="fill-white text-3xl font-semibold">
              {total.toLocaleString()}
            </text>
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className="relative h-[300px] w-full">
      {loading ? (
        <div className="absolute right-0 top-0 z-10 flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-2">
          <Skeleton className="h-2 w-12 bg-white/15" />
          <Skeleton className="h-2 w-8 bg-white/15" />
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
            tick={{ fill: "#CBD5E1", fontSize: 12 }}
            width={90}
          />
          <Tooltip content={<DarkTooltip />} />
          <Bar dataKey="sessions" radius={[999, 999, 999, 999]} fill="#34D399" isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
