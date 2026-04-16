"use client";

import { Accessibility, Gauge, Search, Shield, Sparkles } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";

import type { ClientDashboardIssue, GaDashboardData, GscDashboardData } from "@/types";
import { fetchJson } from "@/lib/api-client";
import {
  buildClientDashboardRewriteContext,
  GOOGLE_CONTEXT_BANNER_COPY
} from "@/lib/client-dashboard-rewrite-context";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

type IssueFilter = "all" | ClientDashboardIssue["severity"];

type PlainEnglishIssue = {
  title: string;
  description: string;
  whatToDo: string;
  realWorldImpact: string;
  category: "performance" | "seo" | "accessibility" | "security" | "best_practices";
  icon: string;
};

type PlainEnglishIssuesResponse = {
  rewritten: boolean;
  items: Array<Partial<PlainEnglishIssue>>;
};

type DisplayIssue = PlainEnglishIssue & {
  id: string;
  severity: ClientDashboardIssue["severity"];
  affectedPages: number;
  urls: string[];
};

const ISSUE_COPY = {
  whatToDoLabel: "Recommended next step",
  impactLabel: "Why this matters"
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

function severityMeta(severity: ClientDashboardIssue["severity"]) {
  if (severity === "critical") {
    return {
      label: "Critical",
      tone: "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-200"
    };
  }

  if (severity === "warning") {
    return {
      label: "Warning",
      tone: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-100"
    };
  }

  return {
    label: "Info",
    tone: "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-100"
  };
}

function categoryIcon(category: PlainEnglishIssue["category"]) {
  if (category === "performance") {
    return Gauge;
  }

  if (category === "seo") {
    return Search;
  }

  if (category === "accessibility") {
    return Accessibility;
  }

  if (category === "security") {
    return Shield;
  }

  return Sparkles;
}

function inferIssueCategory(issue: Pick<ClientDashboardIssue, "id" | "title" | "description">): PlainEnglishIssue["category"] {
  const haystack = `${issue.id} ${issue.title} ${issue.description}`.toLowerCase();

  if (
    /(seo|meta|schema|search|crawl|index|sitemap|canonical|title tag|description tag|broken link|redirect)/.test(
      haystack
    )
  ) {
    return "seo";
  }

  if (/(accessib|aria|contrast|keyboard|screen reader|alt text|label)/.test(haystack)) {
    return "accessibility";
  }

  if (/(security|ssl|header|https|hsts|csp|x-frame|x-content|permission-policy)/.test(haystack)) {
    return "security";
  }

  if (
    /(performance|speed|lcp|cls|tbt|render|cache|script|image|font|payload|load|javascript|css|server response)/.test(
      haystack
    )
  ) {
    return "performance";
  }

  return "best_practices";
}

function toFallbackIssue(issue: ClientDashboardIssue): DisplayIssue {
  const rawDescription = stripMarkdown(issue.description) || stripMarkdown(issue.title) || "This item needs review.";

  return {
    id: issue.id,
    severity: issue.severity,
    affectedPages: issue.affectedPages,
    urls: issue.urls,
    title: issue.title,
    description: rawDescription,
    whatToDo: rawDescription,
    realWorldImpact: rawDescription,
    category: inferIssueCategory(issue),
    icon: ""
  };
}

function mergeIssue(issue: ClientDashboardIssue, rewritten?: Partial<PlainEnglishIssue>): DisplayIssue {
  const fallback = toFallbackIssue(issue);

  return {
    ...fallback,
    title: rewritten?.title?.trim() || fallback.title,
    description: rewritten?.description?.trim() || fallback.description,
    whatToDo: rewritten?.whatToDo?.trim() || fallback.whatToDo,
    realWorldImpact: rewritten?.realWorldImpact?.trim() || fallback.realWorldImpact,
    category: rewritten?.category ?? fallback.category,
    icon: rewritten?.icon?.trim() || fallback.icon
  };
}

function IssueSkeletonCard() {
  return (
    <div className="rounded-[1.8rem] border border-border/70 bg-card/90 p-5 shadow-[0_30px_80px_-48px_rgba(15,23,42,0.38)] backdrop-blur-xl">
      <div className="flex flex-col gap-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <Skeleton className="mt-1 h-10 w-10 rounded-2xl bg-muted" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-5 w-52 bg-muted" />
              <Skeleton className="h-4 w-full bg-muted" />
              <Skeleton className="h-4 w-5/6 bg-muted" />
            </div>
          </div>
          <Skeleton className="h-8 w-24 rounded-full bg-muted" />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-background/80 p-4">
            <Skeleton className="h-4 w-28 bg-muted" />
            <Skeleton className="mt-3 h-4 w-full bg-muted" />
            <Skeleton className="mt-2 h-4 w-5/6 bg-muted" />
          </div>
          <div className="rounded-2xl border border-border bg-background/80 p-4">
            <Skeleton className="h-4 w-32 bg-muted" />
            <Skeleton className="mt-3 h-4 w-full bg-muted" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function Issues({
  issues,
  hasScan,
  websiteUrl,
  gsc,
  ga
}: {
  issues: ClientDashboardIssue[];
  hasScan: boolean;
  websiteUrl: string;
  gsc: GscDashboardData;
  ga: GaDashboardData;
}) {
  const [filter, setFilter] = useState<IssueFilter>("all");
  const [rewrittenIssues, setRewrittenIssues] = useState<DisplayIssue[]>(() => issues.map(toFallbackIssue));
  const [rewriteStatus, setRewriteStatus] = useState<"loading" | "ready" | "fallback">("loading");
  const deferredFilter = useDeferredValue(filter);

  const fallbackIssues = useMemo(() => issues.map(toFallbackIssue), [issues]);
  const counts = useMemo(
    () => ({
      critical: issues.filter((issue) => issue.severity === "critical").length,
      warning: issues.filter((issue) => issue.severity === "warning").length,
      info: issues.filter((issue) => issue.severity === "info").length
    }),
    [issues]
  );
  const { context: rewriteContext, showGoogleConnectBanner } = useMemo(
    () =>
      buildClientDashboardRewriteContext({
        websiteUrl,
        gsc,
        ga
      }),
    [ga, gsc, websiteUrl]
  );

  useEffect(() => {
    setRewrittenIssues(fallbackIssues);

    if (!issues.length) {
      setRewriteStatus("ready");
      return;
    }

    const controller = new AbortController();
    let active = true;

    async function loadPlainEnglish() {
      setRewriteStatus("loading");

      try {
        const response = await fetchJson<PlainEnglishIssuesResponse>("/api/d/plain-english", {
          method: "POST",
          body: JSON.stringify({
            type: "issues",
            context: rewriteContext,
            items: issues.map((issue) => ({
              id: issue.id,
              title: issue.title,
              description: issue.description,
              severity: issue.severity
            }))
          }),
          signal: controller.signal
        });

        if (!active) {
          return;
        }

        if (!response.rewritten) {
          setRewrittenIssues(fallbackIssues);
          setRewriteStatus("fallback");
          return;
        }

        setRewrittenIssues(issues.map((issue, index) => mergeIssue(issue, response.items[index])));
        setRewriteStatus("ready");
      } catch {
        if (!active || controller.signal.aborted) {
          return;
        }

        setRewrittenIssues(fallbackIssues);
        setRewriteStatus("fallback");
      }
    }

    void loadPlainEnglish();

    return () => {
      active = false;
      controller.abort();
    };
  }, [fallbackIssues, issues, rewriteContext]);

  const filteredIssues = useMemo(
    () =>
      deferredFilter === "all"
        ? rewrittenIssues
        : rewrittenIssues.filter((issue) => issue.severity === deferredFilter),
    [deferredFilter, rewrittenIssues]
  );

  if (!hasScan) {
    return (
      <div className="rounded-[1.8rem] border border-border/70 bg-card/90 p-8 text-center shadow-[0_30px_80px_-48px_rgba(15,23,42,0.38)] backdrop-blur-xl">
        <p className="font-display text-2xl font-semibold text-foreground">Your first review is still pending</p>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Once the first scan completes, this page will translate technical issues into clear business language and simple next steps.
        </p>
      </div>
    );
  }

  if (!issues.length) {
    return (
      <div className="rounded-[1.8rem] border border-border/70 bg-card/90 p-8 text-center shadow-[0_30px_80px_-48px_rgba(15,23,42,0.38)] backdrop-blur-xl">
        <p className="font-display text-2xl font-semibold text-foreground">No major issues in the latest review</p>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The latest scan did not flag any urgent problems, so your team can focus on routine improvements instead of firefighting.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {showGoogleConnectBanner ? (
        <div className="rounded-[1.6rem] border border-sky-500/20 bg-sky-500/10 px-5 py-4 text-sm text-sky-700 dark:text-sky-100">
          {GOOGLE_CONTEXT_BANNER_COPY}
        </div>
      ) : null}

      <div className="rounded-[1.8rem] border border-border/70 bg-card/90 p-5 shadow-[0_30px_80px_-48px_rgba(15,23,42,0.38)] backdrop-blur-xl">
        <p className="text-sm leading-6 text-muted-foreground">
          These are the biggest issues most likely to slow down visibility, trust, or conversions.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span>{counts.critical} Critical</span>
          <span className="text-border">|</span>
          <span>{counts.warning} Warnings</span>
          <span className="text-border">|</span>
          <span>{counts.info} Info</span>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          {(["all", "critical", "warning", "info"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setFilter(item)}
              className={cn(
                "rounded-full border px-4 py-2 text-sm font-medium capitalize transition-colors",
                filter === item
                  ? "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-100"
                  : "border-border bg-card/80 text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {rewriteStatus === "loading" ? (
        <div className="space-y-4">
          {Array.from({ length: Math.min(Math.max(issues.length, 1), 3) }).map((_, index) => (
            <IssueSkeletonCard key={index} />
          ))}
        </div>
      ) : filteredIssues.length ? (
        <div className="space-y-4">
          {filteredIssues.map((issue) => {
            const meta = severityMeta(issue.severity);

            return (
              <article
                key={issue.id}
                className="rounded-[1.8rem] border border-border/70 bg-card/90 p-5 shadow-[0_30px_80px_-48px_rgba(15,23,42,0.38)] backdrop-blur-xl"
              >
                <div className="flex flex-col gap-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border bg-background/80 text-foreground">
                        {(() => {
                          const Icon = categoryIcon(issue.category);
                          return <Icon className="h-5 w-5" />;
                        })()}
                      </div>
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-3">
                          <p className="font-display text-xl font-semibold text-foreground">
                            {stripMarkdown(issue.title)}
                          </p>
                          <span
                            className={cn(
                              "rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]",
                              meta.tone
                            )}
                          >
                            {meta.label}
                          </span>
                        </div>
                        <p className="text-sm leading-6 text-muted-foreground">
                          {stripMarkdown(issue.description)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {issue.affectedPages} affected {issue.affectedPages === 1 ? "page" : "pages"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl border border-border bg-background/80 p-4">
                      <p className="text-sm font-semibold text-foreground">{ISSUE_COPY.whatToDoLabel}</p>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">{issue.whatToDo}</p>
                    </div>
                    <div className="rounded-2xl border border-border bg-background/80 p-4">
                      <p className="text-sm font-semibold text-foreground">{ISSUE_COPY.impactLabel}</p>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">{issue.realWorldImpact}</p>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rounded-[1.8rem] border border-border/70 bg-card/90 p-8 text-center shadow-[0_30px_80px_-48px_rgba(15,23,42,0.38)] backdrop-blur-xl">
          <p className="font-display text-2xl font-semibold text-foreground">No issues match this filter</p>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Try a different filter to review the rest of the findings from the latest scan.
          </p>
        </div>
      )}
    </div>
  );
}
