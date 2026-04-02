"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { ScanResult } from "@/types";

export function DeviceScoreChart({ scan }: { scan: ScanResult }) {
  const data = [
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

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid stroke="rgba(148,163,184,0.14)" vertical={false} />
          <XAxis dataKey="device" stroke="#94A3B8" tickLine={false} axisLine={false} />
          <YAxis stroke="#94A3B8" tickLine={false} axisLine={false} domain={[0, 100]} />
          <Tooltip
            contentStyle={{
              background: "#0F172A",
              border: "1px solid #334155",
              borderRadius: "16px"
            }}
          />
          <Bar dataKey="performance" fill="#3B82F6" radius={[10, 10, 0, 0]} />
          <Bar dataKey="accessibility" fill="#22C55E" radius={[10, 10, 0, 0]} />
          <Bar dataKey="seo" fill="#F59E0B" radius={[10, 10, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
