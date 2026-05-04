"use client";

import { useEffect, useMemo, useState } from "react";

import type { ClientDashboardPayload, GaDashboardData, GscDashboardData } from "@/types";
import { GOOGLE_CONTEXT_BANNER_COPY } from "@/lib/client-dashboard-rewrite-context";
import { cn } from "@/lib/utils";

type IssueResult = {
  title: string;
  severity: "critical" | "warning" | "info";
  description: string;
  impact: string;
  category: string;
};

const ISSUE_ORDER: Array<IssueResult["severity"]> = ["critical", "warning", "info"];

function doneKey(siteId: string, title: string) {
  return `sitepulse-client-issue-done:${siteId}:${title.toLowerCase()}`;
}

function severityTone(severity: IssueResult["severity"]) {
  if (severity === "critical") {
    return "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-200";
  }

  if (severity === "warning") {
    return "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-100";
  }

  return "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-100";
}

function Spinner() {
  return <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />;
}

function formatRelativeTime(value: string | null) {
  if (!value) {
    return null;
  }

  const timestamp = new Date(value).getTime();

  if (Number.isNaN(timestamp)) {
    return null;
  }

  const diffMs = timestamp - Date.now();
  const absMs = Math.abs(diffMs);
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  const units = [
    { unit: "year" as const, ms: 1000 * 60 * 60 * 24 * 365 },
    { unit: "month" as const, ms: 1000 * 60 * 60 * 24 * 30 },
    { unit: "day" as const, ms: 1000 * 60 * 60 * 24 },
    { unit: "hour" as const, ms: 1000 * 60 * 60 },
    { unit: "minute" as const, ms: 1000 * 60 }
  ];

  for (const entry of units) {
    if (absMs >= entry.ms) {
      return formatter.format(Math.round(diffMs / entry.ms), entry.unit);
    }
  }

  return "just now";
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

export function Issues({
  token,
  siteId,
  hasScan,
  websiteUrl,
  auditData,
  gsc,
  ga,
  accentColor,
  initialResults,
  initialGeneratedAt
}: {
  token: string;
  siteId: string;
  hasScan: boolean;
  websiteUrl: string;
  auditData: ClientDashboardPayload["auditData"];
  gsc: GscDashboardData;
  ga: GaDashboardData;
  accentColor: string;
  initialResults: IssueResult[] | null;
  initialGeneratedAt: string | null;
}) {
  const [results, setResults] = useState<IssueResult[] | null>(initialResults);
  const [lastAnalyzedAt, setLastAnalyzedAt] = useState<string | null>(initialGeneratedAt);
  const [loading, setLoading] = useState(false);
  const [doneMap, setDoneMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!results?.length) {
      return;
    }

    const nextState = results.reduce<Record<string, boolean>>((accumulator, issue) => {
      accumulator[issue.title] = window.localStorage.getItem(doneKey(siteId, issue.title)) === "true";
      return accumulator;
    }, {});

    setDoneMap(nextState);
  }, [results, siteId]);

  const groupedResults = useMemo(
    () =>
      ISSUE_ORDER.map((severity) => ({
        severity,
        items: (results ?? []).filter((issue) => issue.severity === severity)
      })).filter((group) => group.items.length > 0),
    [results]
  );

  function toggleDone(title: string, checked: boolean) {
    window.localStorage.setItem(doneKey(siteId, title), checked ? "true" : "false");
    setDoneMap((current) => ({ ...current, [title]: checked }));
  }

  async function analyze(clearSaved: boolean) {
    setLoading(true);

    if (clearSaved) {
      setResults(null);
      setLastAnalyzedAt(null);
    }

    try {
      const requestBody = {
        token,
        clearSaved,
        auditData,
        gscData: gsc,
        ga4Data: ga
      };

      console.log("[client-dashboard][issues] sending analyze request", requestBody);

      const response = await fetch("/api/client/analyze-issues", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody)
      });

      const payload = (await response.json().catch(() => null)) as
        | { data?: { issues?: IssueResult[]; generatedAt?: string }; error?: string; rawText?: string }
        | null;

      console.log("[client-dashboard][issues] analyze response status", response.status);
      console.log("[client-dashboard][issues] analyze response body", payload);

      if (!response.ok) {
        throw new Error(payload?.error ?? "Unable to analyze issues.");
      }

      const issues = payload?.data?.issues ?? [];
      console.log("[client-dashboard][issues] setting issues state", issues);

      setResults(
        [...issues].sort(
          (left, right) => ISSUE_ORDER.indexOf(left.severity) - ISSUE_ORDER.indexOf(right.severity)
        )
      );
      setLastAnalyzedAt(payload?.data?.generatedAt ?? new Date().toISOString());
      console.log("[client-dashboard][issues] state update requested");
    } catch (error) {
      console.error("[client-dashboard][issues] analyze failed", error);
    } finally {
      setLoading(false);
    }
  }

  if (!hasScan || !auditData) {
    return (
      <div className="rounded-[1.8rem] border border-border/70 bg-card/90 p-8 text-center shadow-[0_30px_80px_-48px_rgba(15,23,42,0.38)] backdrop-blur-xl">
        <p className="font-display text-2xl font-semibold text-foreground">Your first review is still pending</p>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Once the first scan completes, AI analysis will turn the audit into clear business issues for {websiteUrl}.
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
          Use AI analysis to turn the latest audit into the most important business issues for this site.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          {!results ? (
            <button
              type="button"
              onClick={() => void analyze(false)}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-2xl border px-5 py-3 text-sm font-semibold text-white transition-opacity disabled:opacity-70"
              style={{
                borderColor: hexToRgba(accentColor, 0.28),
                backgroundColor: accentColor
              }}
            >
              {loading ? <Spinner /> : null}
              {loading ? "Analyzing your site..." : "Analyze Issues"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void analyze(true)}
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
        <div className="space-y-6">
          {lastAnalyzedAt ? (
            <p className="text-xs font-medium text-muted-foreground">
              Last analyzed: {formatRelativeTime(lastAnalyzedAt)}
            </p>
          ) : null}
          {groupedResults.map((group) => (
            <section key={group.severity} className="space-y-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                {group.severity} issues
              </p>
              {group.items.map((issue) => (
                <article
                  key={`${group.severity}-${issue.title}`}
                  className="rounded-[1.8rem] border border-border/70 bg-card/90 p-5 shadow-[0_30px_80px_-48px_rgba(15,23,42,0.38)] backdrop-blur-xl"
                >
                  <div className="flex flex-col gap-5">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-3">
                          <p className="font-display text-2xl font-semibold text-foreground">{issue.title}</p>
                          <span
                            className={cn(
                              "rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]",
                              severityTone(issue.severity)
                            )}
                          >
                            {issue.severity}
                          </span>
                        </div>
                        <p className="text-sm leading-6 text-muted-foreground">{issue.description}</p>
                      </div>

                      <label className="flex items-center gap-3 rounded-2xl border border-border bg-background/80 px-4 py-3 text-sm text-foreground">
                        <input
                          type="checkbox"
                          checked={Boolean(doneMap[issue.title])}
                          onChange={(event) => toggleDone(issue.title, event.target.checked)}
                          className="h-4 w-4 rounded border-border bg-transparent text-sky-500 focus:ring-sky-500"
                        />
                        <span>Mark as done</span>
                      </label>
                    </div>

                    <div className="rounded-2xl border border-border bg-background/80 p-4">
                      <p className="text-sm font-semibold text-foreground">Business impact</p>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">{issue.impact}</p>
                    </div>
                  </div>
                </article>
              ))}
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}
