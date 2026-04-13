"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";

import type { ClientDashboardRecommendation } from "@/types";
import { fetchJson } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

type PlainEnglishRecommendation = {
  title: string;
  whatToDo: string;
  whyItMatters: string;
  estimatedTime: string;
  effort: "Easy" | "Medium" | "Hard";
};

type PlainEnglishRecommendationsResponse = {
  rewritten: boolean;
  items: Array<Partial<PlainEnglishRecommendation>>;
};

type DisplayRecommendation = PlainEnglishRecommendation & {
  id: string;
  priority: ClientDashboardRecommendation["priority"];
};

const RECOMMENDATION_COPY = {
  whyItMattersLabel: "\u2705 Why it matters:",
  estimatedTimePrefix: "\u23F1 Estimated time:"
} as const;

function stripMarkdown(text: string | null | undefined) {
  if (!text) {
    return "";
  }

  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/https?:\/\/[^\s)]+/g, "")
    .replace(/\[|\]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function priorityTone(priority: ClientDashboardRecommendation["priority"]) {
  if (priority === "high") {
    return "border-rose-400/20 bg-rose-400/10 text-rose-200";
  }

  if (priority === "medium") {
    return "border-amber-400/20 bg-amber-400/10 text-amber-100";
  }

  return "border-sky-400/20 bg-sky-400/10 text-sky-100";
}

function effortTone(effort: PlainEnglishRecommendation["effort"]) {
  if (effort === "Easy") {
    return "border-emerald-400/20 bg-emerald-400/10 text-emerald-200";
  }

  if (effort === "Hard") {
    return "border-rose-400/20 bg-rose-400/10 text-rose-200";
  }

  return "border-amber-400/20 bg-amber-400/10 text-amber-100";
}

function impactLabel(priority: ClientDashboardRecommendation["priority"]) {
  if (priority === "high") {
    return "High impact";
  }

  if (priority === "medium") {
    return "Medium impact";
  }

  return "Low impact";
}

function fallbackEstimatedTime(priority: ClientDashboardRecommendation["priority"]) {
  if (priority === "high") {
    return "~1 day";
  }

  if (priority === "medium") {
    return "~1 hour";
  }

  return "~30 mins";
}

function fallbackEffort(priority: ClientDashboardRecommendation["priority"]): PlainEnglishRecommendation["effort"] {
  if (priority === "high") {
    return "Hard";
  }

  if (priority === "medium") {
    return "Medium";
  }

  return "Easy";
}

function toFallbackRecommendation(
  recommendation: ClientDashboardRecommendation
): DisplayRecommendation {
  return {
    id: recommendation.id,
    priority: recommendation.priority,
    title: recommendation.title,
    whatToDo: recommendation.action,
    whyItMatters: recommendation.impact,
    estimatedTime: fallbackEstimatedTime(recommendation.priority),
    effort: fallbackEffort(recommendation.priority)
  };
}

function mergeRecommendation(
  recommendation: ClientDashboardRecommendation,
  rewritten?: Partial<PlainEnglishRecommendation>
): DisplayRecommendation {
  const fallback = toFallbackRecommendation(recommendation);

  return {
    ...fallback,
    title: rewritten?.title?.trim() || fallback.title,
    whatToDo: rewritten?.whatToDo?.trim() || fallback.whatToDo,
    whyItMatters: rewritten?.whyItMatters?.trim() || fallback.whyItMatters,
    estimatedTime: rewritten?.estimatedTime?.trim() || fallback.estimatedTime,
    effort:
      rewritten?.effort === "Easy" || rewritten?.effort === "Medium" || rewritten?.effort === "Hard"
        ? rewritten.effort
        : fallback.effort
  };
}

function RecommendationSkeletonCard() {
  return (
    <div className="rounded-[1.8rem] border border-white/10 bg-white/[0.05] p-5 shadow-[0_24px_64px_-36px_rgba(15,23,42,0.72)] backdrop-blur-xl">
      <div className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-6 w-56 bg-white/10" />
            <Skeleton className="h-4 w-full bg-white/10" />
            <Skeleton className="h-4 w-5/6 bg-white/10" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-24 rounded-full bg-white/10" />
            <Skeleton className="h-8 w-28 rounded-full bg-white/10" />
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#08101f]/70 p-4">
          <Skeleton className="h-4 w-28 bg-white/10" />
          <Skeleton className="mt-3 h-4 w-full bg-white/10" />
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Skeleton className="h-4 w-32 bg-white/10" />
          <Skeleton className="h-11 w-40 rounded-2xl bg-white/10" />
        </div>
      </div>
    </div>
  );
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
  const [rewrittenRecommendations, setRewrittenRecommendations] = useState<DisplayRecommendation[]>(
    () => recommendations.map(toFallbackRecommendation)
  );
  const [rewriteStatus, setRewriteStatus] = useState<"loading" | "ready" | "fallback">("loading");

  const fallbackRecommendations = useMemo(
    () => recommendations.map(toFallbackRecommendation),
    [recommendations]
  );

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

  useEffect(() => {
    setRewrittenRecommendations(fallbackRecommendations);

    if (!recommendations.length) {
      setRewriteStatus("ready");
      return;
    }

    const controller = new AbortController();
    let active = true;

    async function loadPlainEnglish() {
      setRewriteStatus("loading");

      try {
        const response = await fetchJson<PlainEnglishRecommendationsResponse>("/api/d/plain-english", {
          method: "POST",
          body: JSON.stringify({
            type: "recommendations",
            items: recommendations.map((recommendation) => ({
              title: recommendation.title,
              description: recommendation.action,
              priority: recommendation.priority
            }))
          }),
          signal: controller.signal
        });

        if (!active) {
          return;
        }

        if (!response.rewritten) {
          setRewrittenRecommendations(fallbackRecommendations);
          setRewriteStatus("fallback");
          return;
        }

        setRewrittenRecommendations(
          recommendations.map((recommendation, index) =>
            mergeRecommendation(recommendation, response.items[index])
          )
        );
        setRewriteStatus("ready");
      } catch {
        if (!active || controller.signal.aborted) {
          return;
        }

        setRewrittenRecommendations(fallbackRecommendations);
        setRewriteStatus("fallback");
      }
    }

    void loadPlainEnglish();

    return () => {
      active = false;
      controller.abort();
    };
  }, [fallbackRecommendations, recommendations]);

  const reviewedSet = useMemo(() => new Set(reviewedIds), [reviewedIds]);
  const reviewedCount = useMemo(
    () => recommendations.filter((recommendation) => reviewedSet.has(recommendation.id)).length,
    [recommendations, reviewedSet]
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

  if (!recommendations.length) {
    return (
      <div className="rounded-[1.8rem] border border-white/10 bg-white/[0.05] p-8 text-center shadow-[0_24px_64px_-36px_rgba(15,23,42,0.72)] backdrop-blur-xl">
        <p className="font-display text-2xl font-semibold text-white">
          No recommendations right now. Your site is in good shape!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[1.8rem] border border-white/10 bg-white/[0.05] p-5 shadow-[0_24px_64px_-36px_rgba(15,23,42,0.72)] backdrop-blur-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Progress</p>
            <p className="mt-2 font-display text-2xl font-semibold text-white">
              {reviewedCount} of {recommendations.length} done
            </p>
          </div>
          <div className="h-3 w-full max-w-sm overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-sky-400 transition-[width] duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

      </div>

      {rewriteStatus === "loading" ? (
        <div className="space-y-4">
          {Array.from({ length: Math.min(Math.max(recommendations.length, 1), 3) }).map((_, index) => (
            <RecommendationSkeletonCard key={index} />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {rewrittenRecommendations.map((recommendation) => {
            const reviewed = reviewedSet.has(recommendation.id);

            return (
              <label
                key={recommendation.id}
                className={cn(
                  "flex cursor-pointer flex-col gap-4 rounded-[1.8rem] border border-white/10 bg-white/[0.05] p-5 shadow-[0_24px_64px_-36px_rgba(15,23,42,0.72)] backdrop-blur-xl transition-colors hover:bg-white/[0.07]",
                  reviewed && "border-emerald-400/20 bg-emerald-400/10"
                )}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-display text-2xl font-semibold text-white">
                        {stripMarkdown(recommendation.title)}
                      </p>
                      <span
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]",
                          effortTone(recommendation.effort)
                        )}
                      >
                        {recommendation.effort}
                      </span>
                      <span
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]",
                          priorityTone(recommendation.priority)
                        )}
                      >
                        {impactLabel(recommendation.priority)}
                      </span>
                    </div>

                    <p className="text-sm leading-6 text-slate-300">
                      {stripMarkdown(recommendation.whatToDo)}
                    </p>

                    <div className="rounded-2xl border border-white/10 bg-[#08101f]/75 p-4">
                      <p className="text-sm font-semibold text-white">{RECOMMENDATION_COPY.whyItMattersLabel}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-300">{recommendation.whyItMatters}</p>
                    </div>

                    <p className="text-sm font-medium text-slate-200">
                      {RECOMMENDATION_COPY.estimatedTimePrefix} {recommendation.estimatedTime}
                    </p>
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
                      Mark as done
                    </span>
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
