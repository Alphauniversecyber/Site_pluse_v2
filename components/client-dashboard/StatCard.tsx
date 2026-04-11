import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";

import { cn } from "@/lib/utils";

function formatChange(change: number) {
  return `${change > 0 ? "+" : ""}${change.toFixed(1)}%`;
}

export function StatCard({
  label,
  value,
  subtext,
  change,
  className
}: {
  label: string;
  value: string;
  subtext: string;
  change: number;
  className?: string;
}) {
  const isUp = change > 0.25;
  const isDown = change < -0.25;

  return (
    <div
      className={cn(
        "rounded-[1.6rem] border border-white/10 bg-white/[0.05] p-5 shadow-[0_24px_64px_-36px_rgba(15,23,42,0.72)] backdrop-blur-xl",
        className
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">{label}</p>
      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <p className="font-display text-3xl font-semibold tracking-tight text-white">{value}</p>
          <p className="mt-2 text-sm text-slate-400">{subtext}</p>
        </div>
        <div
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold",
            isUp
              ? "bg-emerald-500/15 text-emerald-300"
              : isDown
                ? "bg-rose-500/15 text-rose-300"
                : "bg-slate-700/70 text-slate-300"
          )}
        >
          {isUp ? (
            <ArrowUpRight className="h-4 w-4" />
          ) : isDown ? (
            <ArrowDownRight className="h-4 w-4" />
          ) : (
            <ArrowRight className="h-4 w-4" />
          )}
          {formatChange(change)}
        </div>
      </div>
    </div>
  );
}
