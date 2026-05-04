"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { AlertCircle, AlertTriangle, ChevronDown, ChevronUp, Info } from "lucide-react";

import type { ClientDashboardIssue } from "@/types";
import { cn } from "@/lib/utils";

type IssueFilter = "all" | ClientDashboardIssue["severity"];

function severityMeta(severity: ClientDashboardIssue["severity"]) {
  if (severity === "critical") {
    return {
      label: "Critical",
      icon: AlertTriangle,
      tone: "border-rose-400/20 bg-rose-400/10 text-rose-200",
      dot: "bg-rose-400"
    };
  }

  if (severity === "warning") {
    return {
      label: "Warning",
      icon: AlertCircle,
      tone: "border-amber-400/20 bg-amber-400/10 text-amber-100",
      dot: "bg-amber-300"
    };
  }

  return {
    label: "Info",
    icon: Info,
    tone: "border-sky-400/20 bg-sky-400/10 text-sky-100",
    dot: "bg-sky-300"
  };
}

export function Issues({ issues }: { issues: ClientDashboardIssue[] }) {
  const [filter, setFilter] = useState<IssueFilter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const deferredFilter = useDeferredValue(filter);

  const counts = useMemo(
    () => ({
      critical: issues.filter((issue) => issue.severity === "critical").length,
      warning: issues.filter((issue) => issue.severity === "warning").length,
      info: issues.filter((issue) => issue.severity === "info").length
    }),
    [issues]
  );
  const filtered = useMemo(
    () =>
      deferredFilter === "all"
        ? issues
        : issues.filter((issue) => issue.severity === deferredFilter),
    [deferredFilter, issues]
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
          <span className="text-slate-600">·</span>
          <span>{counts.warning} Warnings</span>
          <span className="text-slate-600">·</span>
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
      </div>

      {filtered.length ? (
        <div className="space-y-4">
          {filtered.map((issue) => {
            const meta = severityMeta(issue.severity);
            const Icon = meta.icon;
            const isExpanded = expandedId === issue.id;

            return (
              <button
                key={issue.id}
                type="button"
                onClick={() => setExpandedId(isExpanded ? null : issue.id)}
                className="w-full rounded-[1.8rem] border border-white/10 bg-white/[0.05] p-5 text-left shadow-[0_24px_64px_-36px_rgba(15,23,42,0.72)] backdrop-blur-xl transition-colors hover:bg-white/[0.07]"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-3">
                      <span className={cn("mt-2 h-2.5 w-2.5 rounded-full", meta.dot)} />
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-3">
                          <Icon className="h-4 w-4 text-white" />
                          <p className="font-display text-xl font-semibold text-white">{issue.title}</p>
                        </div>
                        <p className="text-sm leading-6 text-slate-300">{issue.description}</p>
                        <p className="text-sm text-slate-400">
                          {issue.affectedPages} affected {issue.affectedPages === 1 ? "page" : "pages"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-start">
                    <span className={cn("rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]", meta.tone)}>
                      {meta.label}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="h-5 w-5 text-slate-400" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-slate-400" />
                    )}
                  </div>
                </div>

                {isExpanded ? (
                  <div className="mt-5 rounded-2xl border border-white/10 bg-[#08101f]/75 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Affected URLs</p>
                    <div className="mt-3 space-y-2">
                      {issue.urls.map((url) => (
                        <div
                          key={url}
                          className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2 text-sm text-slate-300"
                        >
                          {url}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </button>
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

