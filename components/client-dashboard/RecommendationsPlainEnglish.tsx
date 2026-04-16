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
  whyItMattersLabel: "Why this matters",
  estimatedTimePrefix: "Estimated time"
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
    return "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-200";
  }

  if (priority === "medium") {
    return "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-100";
  }

  return "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-100";
}

function effortTone(effort: PlainEnglishRecommendation["effort"]) {
  if (effort === "Easy") {
    return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200";
  }

  if (effort === "Hard") {
    return "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-200";
  }

  return "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-100";
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
    <div className="rounded-[1.8rem] border border-border/70 bg-card/90 p-5 shadow-[0_30px_80px_-48px_rgba(15,23,42,0.38)] backdrop-blur-xl">
      <div className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-6 w-56 bg-muted" />
            <Skeleton className="h-4 w-full bg-muted" />
            <Skeleton className="h-4 w-5/6 bg-muted" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-24 rounded-full bg-muted" />
            <Skeleton className="h-8 w-28 rounded-full bg-muted" />
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-background/80 p-4">
          <Skeleton className="h-4 w-28 bg-muted" />
          <Skeleton className="mt-3 h-4 w-full bg-muted" />
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Skeleton className="h-4 w-32 bg-muted" />
          <Skeleton className="h-11 w-40 rounded-2xl bg-muted" />
        </div>
      </div>
    </div>
  );
}

export function Recommendations({
  token,
  recommendations,
  hasScan
}: {
  token: string;
  recommendations: ClientDashboardRecommendation[];
  hasScan: boolean;
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

  if (!hasScan) {
    return (
      <div className="rounded-[1.8rem] border border-border/70 bg-card/90 p-8 text-center shadow-[0_30px_80px_-48px_rgba(15,23,42,0.38)] backdrop-blur-xl">
        <p className="font-display text-2xl font-semibold text-foreground">Your action plan will appear after the first review</p>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Once the first scan finishes, this page will turn the findings into a simple, business-friendly checklist.
        </p>
      </div>
    );
  }

  if (!recommendations.length) {
    return (
      <div className="rounded-[1.8rem] border border-border/70 bg-card/90 p-8 text-center shadow-[0_30px_80px_-48px_rgba(15,23,42,0.38)] backdrop-blur-xl">
        <p className="font-display text-2xl font-semibold text-foreground">No active recommendations right now</p>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The latest review did not surface any immediate follow-up actions for your team.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[1.8rem] border border-border/70 bg-card/90 p-5 shadow-[0_30px_80px_-48px_rgba(15,23,42,0.38)] backdrop-blur-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Action plan progress</p>
            <p className="mt-2 font-display text-2xl font-semibold text-foreground">
              {reviewedCount} of {recommendations.length} done
            </p>
          </div>
          <div className="h-3 w-full max-w-sm overflow-hidden rounded-full bg-secondary">
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
                  "flex cursor-pointer flex-col gap-4 rounded-[1.8rem] border border-border/70 bg-card/90 p-5 shadow-[0_30px_80px_-48px_rgba(15,23,42,0.38)] backdrop-blur-xl transition-colors hover:bg-accent/60",
                  reviewed && "border-emerald-500/20 bg-emerald-500/10"
                )}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-display text-2xl font-semibold text-foreground">
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

                    <p className="text-sm leading-6 text-muted-foreground">
                      {stripMarkdown(recommendation.whatToDo)}
                    </p>

                    <div className="rounded-2xl border border-border bg-background/80 p-4">
                      <p className="text-sm font-semibold text-foreground">{RECOMMENDATION_COPY.whyItMattersLabel}</p>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">{recommendation.whyItMatters}</p>
                    </div>

                    <p className="text-sm font-medium text-foreground">
                      {RECOMMENDATION_COPY.estimatedTimePrefix}: {recommendation.estimatedTime}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 rounded-2xl border border-border bg-background/80 px-4 py-3 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={reviewed}
                      onChange={() => toggleReviewed(recommendation.id)}
                      className="h-4 w-4 rounded border-border bg-transparent text-sky-500 focus:ring-sky-500"
                    />
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
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
