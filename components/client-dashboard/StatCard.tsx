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
  status,
  className
}: {
  label: string;
  value: string;
  subtext: string;
  change: number | null;
  status?: string;
  className?: string;
}) {
  const hasTrend = typeof change === "number" && Number.isFinite(change);
  const isUp = hasTrend && change > 0.25;
  const isDown = hasTrend && change < -0.25;

  return (
    <div
      className={cn(
        "rounded-[1.75rem] border border-border/70 bg-card/90 p-5 shadow-[0_30px_80px_-48px_rgba(15,23,42,0.38)] backdrop-blur-xl",
        className
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <p className="font-display text-3xl font-semibold tracking-tight text-foreground">{value}</p>
          <p className="mt-2 text-sm text-muted-foreground">{subtext}</p>
        </div>
        {hasTrend ? (
          <div
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold",
              isUp
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
                : isDown
                  ? "bg-rose-500/15 text-rose-600 dark:text-rose-300"
                  : "bg-secondary text-secondary-foreground"
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
        ) : (
          <div className="inline-flex items-center rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
            {status ?? "Awaiting data"}
          </div>
        )}
      </div>
    </div>
  );
}
