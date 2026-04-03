import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";

import { cn, formatScoreDelta, getScoreTone } from "@/lib/utils";

export function ScoreRing({
  label,
  score,
  delta,
  compact = false,
  className
}: {
  label: string;
  score: number;
  delta?: number | null;
  compact?: boolean;
  className?: string;
}) {
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const progress = circumference - (score / 100) * circumference;
  const tone = getScoreTone(score);
  const direction = delta === undefined || delta === null ? "same" : delta > 0 ? "up" : delta < 0 ? "down" : "same";
  const isCompact = compact;

  return (
    <div
      className={cn(
        "flex flex-col items-center text-center",
        isCompact
          ? "gap-2 rounded-[1.5rem] border border-border bg-card p-4 sm:gap-3 sm:rounded-3xl sm:p-6"
          : "gap-3 rounded-3xl border border-border bg-card px-5 py-6 sm:px-6",
        className
      )}
    >
      <div className="relative">
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
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn("font-display font-semibold leading-none", isCompact ? "text-2xl sm:text-3xl" : "text-[2rem] sm:text-3xl")}>
            {score}
          </span>
          <span
            className={cn(
              "mt-1 block uppercase text-muted-foreground",
              isCompact
                ? "max-w-[72px] text-[10px] leading-[1.15] tracking-[0.18em] sm:text-xs sm:tracking-[0.2em]"
                : "max-w-[86px] text-[11px] leading-[1.15] tracking-[0.16em] sm:text-xs sm:tracking-[0.2em]"
            )}
          >
            {label}
          </span>
        </div>
      </div>
      <div
        className={cn(
          "inline-flex items-center gap-1 rounded-full font-semibold",
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
        {formatScoreDelta(delta)}
      </div>
    </div>
  );
}
