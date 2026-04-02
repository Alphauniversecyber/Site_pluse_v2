"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { ScanResult } from "@/types";

export function ScoreTrendChart({ scans }: { scans: ScanResult[] }) {
  const data = scans
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

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid stroke="rgba(148,163,184,0.14)" vertical={false} />
          <XAxis dataKey="date" stroke="#94A3B8" tickLine={false} axisLine={false} />
          <YAxis stroke="#94A3B8" tickLine={false} axisLine={false} domain={[0, 100]} />
          <Tooltip
            contentStyle={{
              background: "#0F172A",
              border: "1px solid #334155",
              borderRadius: "16px"
            }}
          />
          <Line type="monotone" dataKey="performance" stroke="#3B82F6" strokeWidth={3} dot={false} />
          <Line type="monotone" dataKey="seo" stroke="#22C55E" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="accessibility" stroke="#F59E0B" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
