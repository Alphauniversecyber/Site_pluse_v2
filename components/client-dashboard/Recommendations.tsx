"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";

import type { ClientDashboardRecommendation } from "@/types";
import { cn } from "@/lib/utils";

const GROUP_ORDER = ["high", "medium", "low"] as const;

function priorityTone(priority: ClientDashboardRecommendation["priority"]) {
  if (priority === "high") {
    return "border-rose-400/20 bg-rose-400/10 text-rose-200";
  }

  if (priority === "medium") {
    return "border-amber-400/20 bg-amber-400/10 text-amber-100";
  }

  return "border-sky-400/20 bg-sky-400/10 text-sky-100";
}

export function Recommendations({
  token,
  recommendations
}: {
  token: string;
  recommendations: ClientDashboardRecommendation[];
}) {
  const storageKey = `sitepulse-review-state:${token}`;
  const [reviewedIds, setReviewedIds] = useState<string[]>([]);

  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey);

    if (!stored) {
      return;
    }

    try {
      const parsed = JSON.parse(stored) as string[];
      setReviewedIds(Array.isArray(parsed) ? parsed : []);
    } catch {
      window.localStorage.removeItem(storageKey);
    }
  }, [storageKey]);

  const reviewedSet = useMemo(() => new Set(reviewedIds), [reviewedIds]);
  const reviewedCount = reviewedIds.length;
  const grouped = useMemo(
    () =>
      GROUP_ORDER.map((priority) => ({
        priority,
        items: recommendations.filter((item) => item.priority === priority)
      })).filter((group) => group.items.length),
    [recommendations]
  );
  const progress = recommendations.length
    ? Math.round((reviewedCount / recommendations.length) * 100)
    : 0;

  function toggleReviewed(id: string) {
    setReviewedIds((current) => {
      const next = current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id];

      window.localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[1.8rem] border border-white/10 bg-white/[0.05] p-5 shadow-[0_24px_64px_-36px_rgba(15,23,42,0.72)] backdrop-blur-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Progress</p>
            <p className="mt-2 font-display text-2xl font-semibold text-white">
              {reviewedCount} of {recommendations.length} reviewed
            </p>
          </div>
          <div className="h-3 w-full max-w-sm overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-sky-400 transition-[width] duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      {grouped.map((group) => (
        <div key={group.priority} className="space-y-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
            {group.priority} priority
          </p>
          {group.items.map((recommendation) => {
            const reviewed = reviewedSet.has(recommendation.id);

            return (
              <label
                key={recommendation.id}
                className={cn(
                  "flex cursor-pointer flex-col gap-4 rounded-[1.8rem] border border-white/10 bg-white/[0.05] p-5 shadow-[0_24px_64px_-36px_rgba(15,23,42,0.72)] backdrop-blur-xl transition-colors hover:bg-white/[0.07] lg:flex-row lg:items-start lg:justify-between",
                  reviewed && "border-emerald-400/20 bg-emerald-400/10"
                )}
              >
                <div className="space-y-3">
                  <span className={cn("rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]", priorityTone(recommendation.priority))}>
                    {recommendation.priority}
                  </span>
                  <div>
                    <p className="font-display text-2xl font-semibold text-white">{recommendation.title}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{recommendation.action}</p>
                    <p className="mt-3 text-sm font-medium text-emerald-200">{recommendation.impact}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#08101f]/75 px-4 py-3 text-sm text-slate-200">
                  <input
                    type="checkbox"
                    checked={reviewed}
                    onChange={() => toggleReviewed(recommendation.id)}
                    className="h-4 w-4 rounded border-white/20 bg-transparent text-sky-400 focus:ring-sky-400"
                  />
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                    Mark as reviewed
                  </span>
                </div>
              </label>
            );
          })}
        </div>
      ))}
    </div>
  );
}
