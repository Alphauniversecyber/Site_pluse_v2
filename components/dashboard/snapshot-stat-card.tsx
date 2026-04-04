import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export function SnapshotStatCard({
  label,
  value,
  icon: Icon,
  iconTone,
  iconBg,
  support,
  accent
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  iconTone: string;
  iconBg: string;
  support?: string;
  accent?: string;
}) {
  return (
    <div className="relative flex h-full min-h-[184px] min-w-0 flex-col overflow-hidden rounded-[1.7rem] border border-border/85 bg-background/95 p-5 shadow-[0_22px_60px_-40px_rgba(15,23,42,0.52)] sm:p-6 dark:border-white/7 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(15,23,42,0.88))]">
      <div className="pointer-events-none absolute inset-px rounded-[1.6rem] border border-white/5" />
      <div
        className={cn(
          "pointer-events-none absolute right-0 top-0 h-24 w-24 rounded-full opacity-60 blur-3xl",
          accent ?? "bg-primary/15"
        )}
      />

      <div className="relative flex flex-1 min-w-0 flex-col gap-4">
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
            iconBg,
            iconTone
          )}
        >
          <Icon className="h-5 w-5" />
        </div>

        <div className="min-h-[3.25rem] min-w-0 space-y-1.5">
          <p className="text-sm leading-6 text-muted-foreground break-words whitespace-normal">
            {label}
          </p>
          {support ? (
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground/70">
              {support}
            </p>
          ) : null}
        </div>
      </div>

      <div className="relative pt-5">
        <p className="font-display text-4xl font-semibold leading-none">{value}</p>
      </div>
    </div>
  );
}
