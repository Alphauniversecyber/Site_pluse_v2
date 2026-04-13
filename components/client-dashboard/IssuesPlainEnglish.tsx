"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";

import type { ClientDashboardIssue } from "@/types";
import { fetchJson } from "@/lib/api-client";
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
  criticalIcon: "\u{1F6A8}",
  warningIcon: "\u26A0\uFE0F",
  infoIcon: "\u2139\uFE0F",
  whatToDoLabel: "\u{1F4A1} What to do:",
  impactLabel: "\u{1F4CA} Business impact:"
} as const;

function severityMeta(severity: ClientDashboardIssue["severity"]) {
  if (severity === "critical") {
    return {
      label: "Critical",
      tone: "border-rose-400/20 bg-rose-400/10 text-rose-200"
    };
  }

  if (severity === "warning") {
    return {
      label: "Warning",
      tone: "border-amber-400/20 bg-amber-400/10 text-amber-100"
    };
  }

  return {
    label: "Info",
    tone: "border-sky-400/20 bg-sky-400/10 text-sky-100"
  };
}

function fallbackIssueIcon(severity: ClientDashboardIssue["severity"]) {
  if (severity === "critical") {
    return ISSUE_COPY.criticalIcon;
  }

  if (severity === "warning") {
    return ISSUE_COPY.warningIcon;
  }

  return ISSUE_COPY.infoIcon;
}

function toFallbackIssue(issue: ClientDashboardIssue): DisplayIssue {
  return {
    id: issue.id,
    severity: issue.severity,
    affectedPages: issue.affectedPages,
    urls: issue.urls,
    title: issue.title,
    description: issue.description,
    whatToDo:
      issue.severity === "critical"
        ? "Ask your developer to fix this as soon as possible so it stops hurting the site."
        : "Ask your developer to review this issue and include it in the next round of website updates.",
    realWorldImpact:
      issue.severity === "info"
        ? "This means there is a smaller improvement opportunity that could still make the site easier to use or trust."
        : "This means visitors may have a worse experience and your site may be less likely to turn traffic into leads or sales.",
    category: "best_practices",
    icon: fallbackIssueIcon(issue.severity)
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
    <div className="rounded-[1.8rem] border border-white/10 bg-white/[0.05] p-5 shadow-[0_24px_64px_-36px_rgba(15,23,42,0.72)] backdrop-blur-xl">
      <div className="flex flex-col gap-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <Skeleton className="mt-1 h-10 w-10 rounded-2xl bg-white/10" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-5 w-52 bg-white/10" />
              <Skeleton className="h-4 w-full bg-white/10" />
              <Skeleton className="h-4 w-5/6 bg-white/10" />
            </div>
          </div>
          <Skeleton className="h-8 w-24 rounded-full bg-white/10" />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-[#08101f]/70 p-4">
            <Skeleton className="h-4 w-28 bg-white/10" />
            <Skeleton className="mt-3 h-4 w-full bg-white/10" />
            <Skeleton className="mt-2 h-4 w-5/6 bg-white/10" />
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#08101f]/70 p-4">
            <Skeleton className="h-4 w-32 bg-white/10" />
            <Skeleton className="mt-3 h-4 w-full bg-white/10" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function Issues({ issues }: { issues: ClientDashboardIssue[] }) {
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
            items: issues.map((issue) => ({
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
  }, [fallbackIssues, issues]);

  const filteredIssues = useMemo(
    () =>
      deferredFilter === "all"
        ? rewrittenIssues
        : rewrittenIssues.filter((issue) => issue.severity === deferredFilter),
    [deferredFilter, rewrittenIssues]
  );

  if (!issues.length) {
    return (
      <div className="rounded-[1.8rem] border border-white/10 bg-white/[0.05] p-8 text-center shadow-[0_24px_64px_-36px_rgba(15,23,42,0.72)] backdrop-blur-xl">
        <p className="font-display text-2xl font-semibold text-white">No issues found. Your site looks healthy!</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[1.8rem] border border-white/10 bg-white/[0.05] p-5 shadow-[0_24px_64px_-36px_rgba(15,23,42,0.72)] backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
          <span>{counts.critical} Critical</span>
          <span className="text-slate-600">|</span>
          <span>{counts.warning} Warnings</span>
          <span className="text-slate-600">|</span>
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
                  ? "border-sky-400/30 bg-sky-400/15 text-white"
                  : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]"
              )}
            >
              {item}
            </button>
          ))}
        </div>

        {rewriteStatus === "fallback" ? (
          <p className="mt-4 text-sm text-amber-200">Simplified descriptions unavailable</p>
        ) : null}
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
                className="rounded-[1.8rem] border border-white/10 bg-white/[0.05] p-5 shadow-[0_24px_64px_-36px_rgba(15,23,42,0.72)] backdrop-blur-xl"
              >
                <div className="flex flex-col gap-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-[#08101f]/80 text-xl">
                        <span aria-hidden="true">{issue.icon}</span>
                      </div>
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-3">
                          <p className="font-display text-xl font-semibold text-white">{issue.title}</p>
                          <span
                            className={cn(
                              "rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]",
                              meta.tone
                            )}
                          >
                            {meta.label}
                          </span>
                        </div>
                        <p className="text-sm leading-6 text-slate-300">{issue.description}</p>
                        <p className="text-sm text-slate-400">
                          {issue.affectedPages} affected {issue.affectedPages === 1 ? "page" : "pages"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-[#08101f]/75 p-4">
                      <p className="text-sm font-semibold text-white">{ISSUE_COPY.whatToDoLabel}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-300">{issue.whatToDo}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-[#08101f]/75 p-4">
                      <p className="text-sm font-semibold text-white">{ISSUE_COPY.impactLabel}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-300">{issue.realWorldImpact}</p>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rounded-[1.8rem] border border-white/10 bg-white/[0.05] p-8 text-center shadow-[0_24px_64px_-36px_rgba(15,23,42,0.72)] backdrop-blur-xl">
          <p className="font-display text-2xl font-semibold text-white">No issues found. Your site looks healthy!</p>
        </div>
      )}
    </div>
  );
}
