"use client";

import { useEffect, useMemo, useState } from "react";

import type { ClientDashboardPayload, GaDashboardData, GscDashboardData } from "@/types";
import { fetchJson } from "@/lib/api-client";
import { GOOGLE_CONTEXT_BANNER_COPY } from "@/lib/client-dashboard-rewrite-context";
import { cn } from "@/lib/utils";

type RecommendationResult = {
  title: string;
  priority: "high" | "medium" | "low";
  description: string;
  expectedResult: string;
  effort: "low" | "medium" | "high";
  category: string;
};

const PRIORITY_ORDER: Array<RecommendationResult["priority"]> = ["high", "medium", "low"];

function doneKey(siteId: string, title: string) {
  return `sitepulse-client-recommendation-done:${siteId}:${title.toLowerCase()}`;
}

function priorityTone(priority: RecommendationResult["priority"]) {
  if (priority === "high") {
    return "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-200";
  }

  if (priority === "medium") {
    return "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-100";
  }

  return "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-100";
}

function effortLabel(effort: RecommendationResult["effort"]) {
  if (effort === "low") {
    return "Quick fix";
  }

  if (effort === "medium") {
    return "Some effort";
  }

  return "Major work";
}

function Spinner() {
  return <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />;
}

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.trim().replace("#", "");
  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((character) => `${character}${character}`)
          .join("")
      : normalized;

  if (expanded.length !== 6) {
    return `rgba(59,130,246,${alpha})`;
  }

  const red = Number.parseInt(expanded.slice(0, 2), 16);
  const green = Number.parseInt(expanded.slice(2, 4), 16);
  const blue = Number.parseInt(expanded.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export function Recommendations({
  token,
  siteId,
  hasScan,
  websiteUrl,
  auditData,
  gsc,
  ga,
  accentColor
}: {
  token: string;
  siteId: string;
  hasScan: boolean;
  websiteUrl: string;
  auditData: ClientDashboardPayload["auditData"];
  gsc: GscDashboardData;
  ga: GaDashboardData;
  accentColor: string;
}) {
  const [results, setResults] = useState<RecommendationResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [doneMap, setDoneMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!results?.length) {
      return;
    }

    const nextState = results.reduce<Record<string, boolean>>((accumulator, recommendation) => {
      accumulator[recommendation.title] =
        window.localStorage.getItem(doneKey(siteId, recommendation.title)) === "true";
      return accumulator;
    }, {});

    setDoneMap(nextState);
  }, [results, siteId]);

  const sortedResults = useMemo(
    () =>
      results
        ? [...results].sort(
            (left, right) =>
              PRIORITY_ORDER.indexOf(left.priority) - PRIORITY_ORDER.indexOf(right.priority)
          )
        : [],
    [results]
  );

  function toggleDone(title: string, checked: boolean) {
    window.localStorage.setItem(doneKey(siteId, title), checked ? "true" : "false");
    setDoneMap((current) => ({ ...current, [title]: checked }));
  }

  async function analyze() {
    setLoading(true);

    try {
      const response = await fetchJson<{ recommendations: RecommendationResult[] }>(
        "/api/client/analyze-recommendations",
        {
          method: "POST",
          body: JSON.stringify({
            token,
            auditData,
            gscData: gsc,
            ga4Data: ga
          })
        }
      );

      setResults(response.recommendations);
    } finally {
      setLoading(false);
    }
  }

  if (!hasScan || !auditData) {
    return (
      <div className="rounded-[1.8rem] border border-border/70 bg-card/90 p-8 text-center shadow-[0_30px_80px_-48px_rgba(15,23,42,0.38)] backdrop-blur-xl">
        <p className="font-display text-2xl font-semibold text-foreground">Your action plan is still pending</p>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Once the first scan completes, AI recommendations will turn the audit into a practical growth plan for {websiteUrl}.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!gsc.connected || !ga.connected ? (
        <div className="rounded-[1.6rem] border border-sky-500/20 bg-sky-500/10 px-5 py-4 text-sm text-sky-700 dark:text-sky-100">
          {GOOGLE_CONTEXT_BANNER_COPY}
        </div>
      ) : null}

      <div className="rounded-[1.8rem] border border-border/70 bg-card/90 p-6 shadow-[0_30px_80px_-48px_rgba(15,23,42,0.38)] backdrop-blur-xl">
        <p className="text-sm leading-6 text-muted-foreground">
          Generate tailored recommendations that combine the latest scan with any available Google data.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          {!results ? (
            <button
              type="button"
              onClick={() => void analyze()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-2xl border px-5 py-3 text-sm font-semibold text-white transition-opacity disabled:opacity-70"
              style={{
                borderColor: hexToRgba(accentColor, 0.28),
                backgroundColor: accentColor
              }}
            >
              {loading ? <Spinner /> : null}
              {loading ? "Analyzing your site..." : "Get Recommendations"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void analyze()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-2xl border border-border bg-background/80 px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-accent disabled:opacity-70"
            >
              {loading ? <Spinner /> : null}
              {loading ? "Analyzing your site..." : "Re-analyze"}
            </button>
          )}
        </div>
      </div>

      {results ? (
        <div className="space-y-4">
          {sortedResults.map((recommendation) => (
            <article
              key={recommendation.title}
              className="rounded-[1.8rem] border border-border/70 bg-card/90 p-5 shadow-[0_30px_80px_-48px_rgba(15,23,42,0.38)] backdrop-blur-xl"
            >
              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="font-display text-2xl font-semibold text-foreground">
                        {recommendation.title}
                      </p>
                      <span
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]",
                          priorityTone(recommendation.priority)
                        )}
                      >
                        {recommendation.priority} priority
                      </span>
                      <span className="rounded-full border border-border bg-background/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        {effortLabel(recommendation.effort)}
                      </span>
                    </div>
                    <p className="text-sm leading-6 text-muted-foreground">{recommendation.description}</p>
                  </div>

                  <label className="flex items-center gap-3 rounded-2xl border border-border bg-background/80 px-4 py-3 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={Boolean(doneMap[recommendation.title])}
                      onChange={(event) => toggleDone(recommendation.title, event.target.checked)}
                      className="h-4 w-4 rounded border-border bg-transparent text-sky-500 focus:ring-sky-500"
                    />
                    <span>Mark as done</span>
                  </label>
                </div>

                <div className="rounded-2xl border border-border bg-background/80 p-4">
                  <p className="text-sm font-semibold text-foreground">Expected result</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {recommendation.expectedResult}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}
