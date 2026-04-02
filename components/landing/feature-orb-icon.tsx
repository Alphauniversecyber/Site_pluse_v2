import { BellRing, FileBarChart2, Gauge, LineChart, Search, ShieldCheck } from "lucide-react";

import { cn } from "@/lib/utils";

export function FeatureOrbIcon({
  kind,
  className
}: {
  kind: "scanning" | "seo" | "accessibility" | "pdf" | "alerts" | "trends";
  className?: string;
}) {
  const iconMap = {
    scanning: {
      icon: Gauge,
      animation: "feature-icon-subtle-pulse"
    },
    seo: {
      icon: Search,
      animation: ""
    },
    accessibility: {
      icon: ShieldCheck,
      animation: ""
    },
    pdf: {
      icon: FileBarChart2,
      animation: ""
    },
    alerts: {
      icon: BellRing,
      animation: ""
    },
    trends: {
      icon: LineChart,
      animation: "feature-icon-subtle-rise"
    }
  }[kind];

  const Icon = iconMap.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center text-slate-200 transition duration-200 ease-out group-hover:scale-[1.05] group-hover:text-primary",
        className
      )}
    >
      <Icon className={cn("h-11 w-11", iconMap.animation)} strokeWidth={2.15} />
    </span>
  );
}
