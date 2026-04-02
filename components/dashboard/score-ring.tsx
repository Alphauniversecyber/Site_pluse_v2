import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";

import { cn, formatScoreDelta, getScoreTone } from "@/lib/utils";

export function ScoreRing({
  label,
  score,
  delta
}: {
  label: string;
  score: number;
  delta?: number | null;
}) {
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const progress = circumference - (score / 100) * circumference;
  const tone = getScoreTone(score);
  const direction = delta === undefined || delta === null ? "same" : delta > 0 ? "up" : delta < 0 ? "down" : "same";

  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl border border-border bg-card p-6 text-center">
      <div className="relative">
        <svg width="124" height="124" viewBox="0 0 124 124" className="-rotate-90">
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
          <span className="font-display text-3xl font-semibold">{score}</span>
          <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</span>
        </div>
      </div>
      <div className={cn("inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold", tone.bg, tone.classes)}>
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
