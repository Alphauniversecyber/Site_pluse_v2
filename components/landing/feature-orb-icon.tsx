import {
  BellRing,
  FileBarChart2,
  Gauge,
  LineChart,
  Rocket,
  Search,
  Shield,
  ShieldCheck,
  TrendingUp
} from "lucide-react";

import { cn } from "@/lib/utils";

export function FeatureOrbIcon({
  kind,
  className
}: {
  kind: "scanning" | "seo" | "accessibility" | "pdf" | "alerts" | "trends";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex h-24 w-24 items-center justify-center rounded-full border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.15),_transparent_40%),linear-gradient(180deg,_#1E2F59,_#0F172A)] shadow-[0_20px_40px_-20px_rgba(15,23,42,0.9)]",
        className
      )}
    >
      {kind === "scanning" ? (
        <>
          <Gauge className="absolute h-12 w-12 -translate-x-2 translate-y-1 text-white" strokeWidth={1.8} />
          <Rocket className="absolute h-8 w-8 translate-x-4 -translate-y-3 text-blue-400" strokeWidth={2.2} />
        </>
      ) : null}
      {kind === "seo" ? (
        <>
          <Search className="absolute h-12 w-12 -translate-x-1 text-white" strokeWidth={1.9} />
          <TrendingUp className="absolute h-7 w-7 translate-x-4 translate-y-1 text-blue-400" strokeWidth={2.4} />
        </>
      ) : null}
      {kind === "accessibility" ? (
        <>
          <Shield className="absolute h-12 w-12 text-blue-400" strokeWidth={1.9} />
          <ShieldCheck className="absolute h-7 w-7 translate-x-5 translate-y-5 text-white" strokeWidth={2.2} />
        </>
      ) : null}
      {kind === "pdf" ? <FileBarChart2 className="h-12 w-12 text-white" strokeWidth={2} /> : null}
      {kind === "alerts" ? <BellRing className="h-12 w-12 text-white" strokeWidth={2} /> : null}
      {kind === "trends" ? <LineChart className="h-12 w-12 text-blue-400" strokeWidth={2.1} /> : null}
    </div>
  );
}
