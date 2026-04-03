import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";

import { cn, formatScoreDelta, getScoreTone } from "@/lib/utils";

export function ScoreRing({
  label,
  score,
  delta,
  compact = false,
  statusLabel,
  className
}: {
  label: string;
  score: number;
  delta?: number | null;
  compact?: boolean;
  statusLabel?: string | null;
  className?: string;
}) {
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const progress = circumference - (score / 100) * circumference;
  const tone = getScoreTone(score);
  const hasDelta = delta !== undefined && delta !== null && !Number.isNaN(delta);
  const direction = !hasDelta ? "same" : delta > 0 ? "up" : delta < 0 ? "down" : "same";
  const isCompact = compact;
  const trendText = statusLabel ?? (hasDelta ? formatScoreDelta(delta) : null);

  return (
    <div
      className={cn(
        "flex h-full min-w-0 flex-col items-center text-center",
        isCompact
          ? "gap-3 rounded-[1.5rem] border border-border bg-card p-4 sm:gap-3.5 sm:rounded-3xl sm:p-6"
          : "gap-4 rounded-3xl border border-border bg-card px-5 py-6 sm:px-6",
        className
      )}
    >
      <div className="relative shrink-0">
        <svg
          viewBox="0 0 124 124"
          className={cn("-rotate-90", isCompact ? "h-24 w-24 sm:h-[124px] sm:w-[124px]" : "h-[110px] w-[110px] sm:h-[118px] sm:w-[118px]")}
        >
          <circle
            cx="62"
            cy="62"
            r={radius}
            stroke="rgba(148,163,184,0.18)"
            strokeWidth="10"
            fill="none"
          />
          <circle
            cx="62"
            cy="62"
            r={radius}
            strokeWidth="10"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={progress}
            className={cn(tone.ring)}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn("font-display font-semibold leading-none", isCompact ? "text-2xl sm:text-3xl" : "text-[2rem] sm:text-3xl")}>
            {score}
          </span>
        </div>
      </div>

      <div className={cn("flex w-full min-w-0 flex-col items-center", isCompact ? "gap-2" : "gap-2.5")}>
        <div
          className={cn(
            "flex items-center justify-center px-1",
            isCompact ? "min-h-[2.25rem] max-w-[8rem] sm:min-h-[2.5rem] sm:max-w-[9rem]" : "min-h-[2.5rem] max-w-[9rem] sm:max-w-[10rem]"
          )}
        >
          <span
            className={cn(
              "block break-words text-center uppercase text-muted-foreground whitespace-normal",
              isCompact
                ? "text-[10px] leading-4 tracking-[0.16em] sm:text-xs sm:tracking-[0.18em]"
                : "text-[11px] leading-4 tracking-[0.16em] sm:text-xs sm:tracking-[0.18em]"
            )}
          >
            {label}
          </span>
        </div>

        {trendText ? (
          <div
            className={cn(
              "inline-flex max-w-full flex-wrap items-center justify-center gap-1 rounded-full text-center font-semibold",
              isCompact ? "px-2.5 py-1 text-[11px] sm:px-3 sm:text-xs" : "px-3 py-1 text-xs",
              tone.bg,
              tone.classes
            )}
          >
            {direction === "up" ? (
              <ArrowUpRight className="h-4 w-4" />
            ) : direction === "down" ? (
              <ArrowDownRight className="h-4 w-4" />
            ) : (
              <ArrowRight className="h-4 w-4" />
            )}
            {trendText}
          </div>
        ) : null}
      </div>
    </div>
  );
}
