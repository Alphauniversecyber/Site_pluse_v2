"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Copy, Eye, Search } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { BrokenLinkRecord } from "@/types";

type LinkIssueKind = "broken" | "redirect" | "timeout" | "server";
type LinkScope = "internal" | "external";

type LinkIssueRow = {
  id: string;
  title: string;
  issueTypeLabel: string;
  issueTypeKey: LinkIssueKind;
  scope: LinkScope;
  url: string;
  displayUrl: string;
  sourcePages: string[];
  sourceSummary: string;
  status: number;
  statusLabel: string;
  occurrences: number;
  noisy: boolean;
  redirectedTo: string | null;
  impactScore: number;
};

type LinkHealthPanelProps = {
  brokenLinks: BrokenLinkRecord | null;
  websiteUrl: string;
  isHydrating?: boolean;
};

const PAGE_SIZE = 10;

function parseUrl(value?: string | null) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function compressPath(pathname: string) {
  if (!pathname || pathname === "/") {
    return "/";
  }

  if (pathname.length <= 52) {
    return pathname;
  }

  const parts = pathname.split("/").filter(Boolean);
  if (parts.length <= 2) {
    return `${pathname.slice(0, 49)}...`;
  }

  return `/${parts[0]}/${parts[1]}/.../${parts[parts.length - 1]}`;
}

function isTemporaryOrSignedUrl(value: string) {
  return (
    /[?&](token|signature|expires|x-amz-|sig=|sv=|se=|sp=|download=|response-content)/i.test(value) ||
    /\/storage\/v1\/object\/sign\//i.test(value) ||
    /\?.{60,}$/.test(value)
  );
}

function isInternalGeneratedFileUrl(value: string) {
  return /\/(_next|storage|api|reports|exports|download)\//i.test(value) || /\.(pdf|csv|zip|json)(\?|$)/i.test(value);
}

function normalizeUrlKey(value: string) {
  const parsed = parseUrl(value);
  if (!parsed) {
    return value.trim().toLowerCase();
  }

  const noisy = isTemporaryOrSignedUrl(value) || isInternalGeneratedFileUrl(value);
  return `${parsed.origin.toLowerCase()}${parsed.pathname.toLowerCase()}${noisy ? "" : parsed.search.toLowerCase()}`;
}

function compactUrl(value: string, siteHostname: string | null) {
  const parsed = parseUrl(value);
  if (!parsed) {
    return value;
  }

  const sameHost = siteHostname ? parsed.hostname === siteHostname : false;
  const base = `${sameHost ? "" : `${parsed.hostname}`}${compressPath(parsed.pathname)}`;
  return base || parsed.hostname || value;
}

function issueTypeFromStatus(kind: "broken" | "redirect", status: number) {
  if (kind === "redirect") {
    return {
      key: "redirect" as const,
      label: "Redirect chain"
    };
  }

  if (!status) {
    return {
      key: "timeout" as const,
      label: "Timeout"
    };
  }

  if (status >= 500) {
    return {
      key: "server" as const,
      label: "Server error"
    };
  }

  return {
    key: "broken" as const,
    label: "Broken link"
  };
}

function statusBadgeVariant(status: number, issueTypeKey: LinkIssueKind) {
  if (issueTypeKey === "redirect") {
    return "warning" as const;
  }

  if (issueTypeKey === "server" || issueTypeKey === "timeout") {
    return "danger" as const;
  }

  return status >= 500 ? ("danger" as const) : ("warning" as const);
}

function issueTypeBadgeVariant(issueTypeKey: LinkIssueKind) {
  if (issueTypeKey === "redirect") {
    return "warning" as const;
  }

  if (issueTypeKey === "server" || issueTypeKey === "timeout") {
    return "danger" as const;
  }

  return "outline" as const;
}

function getStatusLabel(status: number) {
  return status ? `${status}` : "Timeout";
}

function buildIssueTitle(url: string, issueTypeLabel: string, noisy: boolean) {
  const parsed = parseUrl(url);
  const pathLabel = parsed ? compressPath(parsed.pathname) : url;
  const targetLabel = pathLabel === "/" ? "homepage" : pathLabel;

  if (noisy) {
    if (isTemporaryOrSignedUrl(url)) {
      return "Temporary asset URL";
    }

    if (isInternalGeneratedFileUrl(url)) {
      return "Internal generated file link";
    }
  }

  if (issueTypeLabel === "Redirect chain") {
    return `Redirect chain to ${targetLabel}`;
  }

  if (issueTypeLabel === "Timeout") {
    return `Timeout reaching ${targetLabel}`;
  }

  if (issueTypeLabel === "Server error") {
    return `Server error on ${targetLabel}`;
  }

  return `Broken link to ${targetLabel}`;
}

function buildSourceSummary(sourcePages: string[], siteHostname: string | null) {
  if (!sourcePages.length) {
    return "No source page captured";
  }

  const primary = compactUrl(sourcePages[0], siteHostname);
  if (sourcePages.length === 1) {
    return primary;
  }

  return `${primary} +${sourcePages.length - 1} more`;
}

function buildImpactScore(status: number, issueTypeKey: LinkIssueKind, occurrences: number) {
  const base =
    issueTypeKey === "timeout"
      ? 95
      : issueTypeKey === "server"
        ? 90
        : issueTypeKey === "broken"
          ? 80
          : 55;

  const statusBoost = status >= 500 ? 10 : status >= 400 ? 6 : status >= 300 ? 2 : 0;
  return base + statusBoost + Math.min(occurrences, 12) * 3;
}

function buildLinkIssues(record: BrokenLinkRecord, websiteUrl: string) {
  const siteHostname = parseUrl(websiteUrl)?.hostname ?? null;
  const grouped = new Map<
    string,
    {
      url: string;
      status: number;
      issueTypeLabel: string;
      issueTypeKey: LinkIssueKind;
      scope: LinkScope;
      noisy: boolean;
      redirectedTo: string | null;
      sourcePages: Map<string, number>;
      occurrences: number;
    }
  >();
  const sourcePageCounts = new Map<string, number>();

  for (const item of record.broken_urls ?? []) {
    const issueType = issueTypeFromStatus("broken", item.status);
    const noisy = isTemporaryOrSignedUrl(item.url) || isInternalGeneratedFileUrl(item.url);
    const parsed = parseUrl(item.url);
    const scope: LinkScope = siteHostname && parsed ? (parsed.hostname === siteHostname ? "internal" : "external") : "internal";
    const key = `broken:${issueType.key}:${item.status}:${normalizeUrlKey(item.url)}`;
    const existing = grouped.get(key);

    if (!existing) {
      grouped.set(key, {
        url: item.url,
        status: item.status,
        issueTypeLabel: issueType.label,
        issueTypeKey: issueType.key,
        scope,
        noisy,
        redirectedTo: null,
        sourcePages: new Map(item.parent_url ? [[item.parent_url, 1]] : []),
        occurrences: 1
      });
    } else {
      existing.occurrences += 1;
      if (item.parent_url) {
        existing.sourcePages.set(item.parent_url, (existing.sourcePages.get(item.parent_url) ?? 0) + 1);
      }
    }

    if (item.parent_url) {
      sourcePageCounts.set(item.parent_url, (sourcePageCounts.get(item.parent_url) ?? 0) + 1);
    }
  }

  for (const item of record.redirect_urls ?? []) {
    const issueType = issueTypeFromStatus("redirect", item.status);
    const noisy = isTemporaryOrSignedUrl(item.url) || isInternalGeneratedFileUrl(item.url);
    const parsed = parseUrl(item.url);
    const scope: LinkScope = siteHostname && parsed ? (parsed.hostname === siteHostname ? "internal" : "external") : "internal";
    const key = `redirect:${item.status}:${normalizeUrlKey(item.url)}:${normalizeUrlKey(item.redirected_to ?? "")}`;
    const existing = grouped.get(key);

    if (!existing) {
      grouped.set(key, {
        url: item.url,
        status: item.status,
        issueTypeLabel: issueType.label,
        issueTypeKey: issueType.key,
        scope,
        noisy,
        redirectedTo: item.redirected_to ?? null,
        sourcePages: new Map(item.parent_url ? [[item.parent_url, 1]] : []),
        occurrences: 1
      });
    } else {
      existing.occurrences += 1;
      if (item.parent_url) {
        existing.sourcePages.set(item.parent_url, (existing.sourcePages.get(item.parent_url) ?? 0) + 1);
      }
    }

    if (item.parent_url) {
      sourcePageCounts.set(item.parent_url, (sourcePageCounts.get(item.parent_url) ?? 0) + 1);
    }
  }

  const issues = Array.from(grouped.entries()).map(([id, item]) => {
    const sourcePages = Array.from(item.sourcePages.entries())
      .sort((left, right) => right[1] - left[1])
      .map(([source]) => source);

    return {
      id,
      title: buildIssueTitle(item.url, item.issueTypeLabel, item.noisy),
      issueTypeLabel: item.issueTypeLabel,
      issueTypeKey: item.issueTypeKey,
      scope: item.scope,
      url: item.url,
      displayUrl: compactUrl(item.url, siteHostname),
      sourcePages,
      sourceSummary: buildSourceSummary(sourcePages, siteHostname),
      status: item.status,
      statusLabel: getStatusLabel(item.status),
      occurrences: item.occurrences,
      noisy: item.noisy,
      redirectedTo: item.redirectedTo,
      impactScore: buildImpactScore(item.status, item.issueTypeKey, item.occurrences)
    } satisfies LinkIssueRow;
  });

  const topPages = Array.from(sourcePageCounts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([source]) => compactUrl(source, siteHostname));

  return {
    issues,
    topPages,
    siteHostname,
    uniqueSourcePages: sourcePageCounts.size
  };
}

function buildRecommendations(issues: LinkIssueRow[]) {
  const suggestions: string[] = [];

  if (issues.some((issue) => issue.noisy)) {
    suggestions.push("Review signed or generated asset links first. They are creating the noisiest failures.");
  }

  if (issues.some((issue) => issue.issueTypeKey === "redirect")) {
    suggestions.push("Replace chained redirects with the final destination URL to reduce crawl waste.");
  }

  if (issues.some((issue) => issue.issueTypeKey === "server" || issue.issueTypeKey === "timeout")) {
    suggestions.push("Investigate unstable pages or endpoints returning server errors and timeouts.");
  }

  if (!suggestions.length) {
    suggestions.push("Start with the most repeated broken links on your highest-traffic pages.");
  }

  return suggestions.slice(0, 3);
}

export function LinkHealthPanel({ brokenLinks, websiteUrl, isHydrating = false }: LinkHealthPanelProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [scopeFilter, setScopeFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortBy, setSortBy] = useState("impact");
  const [page, setPage] = useState(1);
  const [selectedIssue, setSelectedIssue] = useState<LinkIssueRow | null>(null);
  const safeRecord = useMemo(
    () =>
      brokenLinks
        ? {
            ...brokenLinks,
            total_links: brokenLinks.total_links ?? 0,
            working_links: brokenLinks.working_links ?? 0,
            broken_links: brokenLinks.broken_links ?? 0,
            redirect_chains: brokenLinks.redirect_chains ?? 0,
            broken_urls: Array.isArray(brokenLinks.broken_urls) ? brokenLinks.broken_urls : [],
            redirect_urls: Array.isArray(brokenLinks.redirect_urls) ? brokenLinks.redirect_urls : []
          }
        : null,
    [brokenLinks]
  );

  const derived = useMemo(
    () => (safeRecord ? buildLinkIssues(safeRecord, websiteUrl) : null),
    [safeRecord, websiteUrl]
  );

  const filteredIssues = useMemo(() => {
    if (!derived) {
      return [];
    }

    const query = search.trim().toLowerCase();

    const filtered = derived.issues.filter((issue) => {
      if (statusFilter === "4xx" && !(issue.status >= 400 && issue.status < 500)) {
        return false;
      }

      if (statusFilter === "5xx" && !(issue.status >= 500 && issue.status < 600)) {
        return false;
      }

      if (statusFilter === "3xx" && !(issue.status >= 300 && issue.status < 400)) {
        return false;
      }

      if (statusFilter === "timeout" && issue.status !== 0) {
        return false;
      }

      if (scopeFilter !== "all" && issue.scope !== scopeFilter) {
        return false;
      }

      if (typeFilter !== "all" && issue.issueTypeKey !== typeFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      const haystack = [
        issue.title,
        issue.displayUrl,
        issue.issueTypeLabel,
        issue.sourceSummary,
        ...issue.sourcePages.map((source) => compactUrl(source, derived.siteHostname))
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });

    return filtered.sort((left, right) => {
      if (sortBy === "repeated") {
        return right.occurrences - left.occurrences || right.impactScore - left.impactScore;
      }

      if (sortBy === "status") {
        return right.status - left.status || right.impactScore - left.impactScore;
      }

      if (sortBy === "alphabetical") {
        return left.title.localeCompare(right.title);
      }

      return right.impactScore - left.impactScore || right.occurrences - left.occurrences;
    });
  }, [derived, scopeFilter, search, sortBy, statusFilter, typeFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, sortBy, scopeFilter, statusFilter, typeFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredIssues.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedIssues = filteredIssues.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const recommendations = useMemo(() => buildRecommendations(derived?.issues ?? []), [derived?.issues]);

  const summaryHeadline = `${safeRecord?.broken_links ?? 0} broken links and ${safeRecord?.redirect_chains ?? 0} redirect chains found`;
  const summaryBody = `SitePulse grouped ${filteredIssues.length || derived?.issues.length || 0} unique link issues across ${
    derived?.uniqueSourcePages ?? 0
  } source page${(derived?.uniqueSourcePages ?? 0) === 1 ? "" : "s"}.`;

  const copyValue = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied.`);
    } catch {
      toast.error(`Unable to copy ${label.toLowerCase()}.`);
    }
  };

  if (!safeRecord) {
    return (
      <p className="rounded-2xl border border-border bg-background p-4 text-sm text-muted-foreground">
        {isHydrating
          ? "Generating link health data from the latest scan. This usually takes a few seconds."
          : "Link health data will appear here after the next completed scan or manual link crawl runs."}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-2xl border border-border bg-background p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Total links</p>
          <p className="mt-2 font-display text-3xl font-semibold">{safeRecord.total_links}</p>
        </div>
        <div className="rounded-2xl border border-border bg-background p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Broken links</p>
          <p className="mt-2 font-display text-3xl font-semibold">{safeRecord.broken_links}</p>
        </div>
        <div className="rounded-2xl border border-border bg-background p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Redirect chains</p>
          <p className="mt-2 font-display text-3xl font-semibold">{safeRecord.redirect_chains}</p>
        </div>
      </div>

      <div className="rounded-3xl border border-border bg-background p-4 sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Link health summary</p>
            <p className="mt-2 text-lg font-semibold">{summaryHeadline}</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{summaryBody}</p>
          </div>
          <div className="flex flex-wrap gap-2 xl:max-w-sm xl:justify-end">
            {(derived?.topPages.length ? derived.topPages : ["No priority pages yet"]).map((pageLabel) => (
              <div
                key={pageLabel}
                className="rounded-full border border-border/80 bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground"
              >
                {pageLabel}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {recommendations.map((item) => (
            <div key={item} className="rounded-2xl border border-border/80 bg-card px-4 py-3">
              <p className="text-sm leading-6 text-muted-foreground">{item}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-border bg-background p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold">Broken URLs</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Raw URLs are condensed into grouped issues so the worst problems stay readable.
            </p>
          </div>
          <div className="text-sm text-muted-foreground">
            Showing {filteredIssues.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0}-
            {Math.min(currentPage * PAGE_SIZE, filteredIssues.length)} of {filteredIssues.length} issue groups
          </div>
        </div>

        <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_repeat(4,minmax(0,0.7fr))]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search issues, URLs, or source pages"
              className="pl-9"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status codes</SelectItem>
              <SelectItem value="4xx">4xx only</SelectItem>
              <SelectItem value="5xx">5xx only</SelectItem>
              <SelectItem value="3xx">3xx only</SelectItem>
              <SelectItem value="timeout">Timeouts</SelectItem>
            </SelectContent>
          </Select>

          <Select value={scopeFilter} onValueChange={setScopeFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Scope" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All scopes</SelectItem>
              <SelectItem value="internal">Internal</SelectItem>
              <SelectItem value="external">External</SelectItem>
            </SelectContent>
          </Select>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Issue type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All issue types</SelectItem>
              <SelectItem value="broken">Broken links</SelectItem>
              <SelectItem value="redirect">Redirect chains</SelectItem>
              <SelectItem value="timeout">Timeouts</SelectItem>
              <SelectItem value="server">Server errors</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger>
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="impact">Highest impact</SelectItem>
              <SelectItem value="repeated">Most repeated</SelectItem>
              <SelectItem value="status">Status code</SelectItem>
              <SelectItem value="alphabetical">Alphabetical</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {pagedIssues.length ? (
          <>
            <div className="mt-4 space-y-3 md:hidden">
              {pagedIssues.map((issue) => (
                <div key={issue.id} className="rounded-2xl border border-border/80 bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{issue.title}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge variant={issueTypeBadgeVariant(issue.issueTypeKey)}>{issue.issueTypeLabel}</Badge>
                        <Badge variant={statusBadgeVariant(issue.status, issue.issueTypeKey)}>
                          {issue.statusLabel}
                        </Badge>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setSelectedIssue(issue)}>
                      <Eye className="h-4 w-4" />
                      Details
                    </Button>
                  </div>

                  <div className="mt-4 space-y-3 text-sm text-muted-foreground">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground">URL</p>
                      <p className="truncate">{issue.displayUrl}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground">Found on</p>
                      <p className="truncate">{issue.sourceSummary}</p>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>{issue.scope}</span>
                      <span>{issue.occurrences} occurrence{issue.occurrences === 1 ? "" : "s"}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 hidden overflow-hidden rounded-2xl border border-border/80 md:block">
              <Table>
                <TableHeader className="bg-card/70">
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Issue</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead>Found on</TableHead>
                    <TableHead className="w-[120px]">Status</TableHead>
                    <TableHead className="w-[120px]">Occurrences</TableHead>
                    <TableHead className="w-[120px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedIssues.map((issue) => (
                    <TableRow key={issue.id} className="bg-background/70">
                      <TableCell className="min-w-0">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{issue.title}</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Badge variant={issueTypeBadgeVariant(issue.issueTypeKey)}>{issue.issueTypeLabel}</Badge>
                            <Badge variant="outline">{issue.scope}</Badge>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[240px]">
                        <p className="truncate text-sm text-muted-foreground">{issue.displayUrl}</p>
                      </TableCell>
                      <TableCell className="max-w-[240px]">
                        <p className="truncate text-sm text-muted-foreground">{issue.sourceSummary}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(issue.status, issue.issueTypeKey)}>{issue.statusLabel}</Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-foreground">{issue.occurrences}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => setSelectedIssue(issue)}>
                          <Eye className="h-4 w-4" />
                          View details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-muted-foreground">
                Sorted by{" "}
                <span className="font-medium text-foreground">
                  {sortBy === "impact"
                    ? "highest impact"
                    : sortBy === "repeated"
                      ? "most repeated"
                      : sortBy === "status"
                        ? "status code"
                        : "alphabetical"}
                </span>
                .
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                >
                  Previous
                </Button>
                <div className="rounded-full border border-border/80 bg-card px-3 py-1.5 text-sm text-muted-foreground">
                  Page {currentPage} of {pageCount}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= pageCount}
                  onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        ) : derived?.issues.length ? (
          <div className="mt-4 rounded-2xl border border-dashed border-border bg-card/50 p-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <p className="mt-4 font-medium">No link issues match these filters.</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Try resetting the search or filters to see the full crawl summary again.
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => {
                setSearch("");
                setStatusFilter("all");
                setScopeFilter("all");
                setTypeFilter("all");
                setSortBy("impact");
              }}
            >
              Reset filters
            </Button>
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-emerald-500/20 bg-emerald-500/5 p-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500">
              <Eye className="h-5 w-5" />
            </div>
            <p className="mt-4 font-medium">No broken links or redirect chains were found.</p>
            <p className="mt-2 text-sm text-muted-foreground">
              The latest internal crawl came back clean, so there are no grouped link issues to review.
            </p>
          </div>
        )}
      </div>

      <Dialog open={Boolean(selectedIssue)} onOpenChange={(open) => !open && setSelectedIssue(null)}>
        <DialogContent className="max-w-3xl">
          {selectedIssue ? (
            <>
              <DialogHeader>
                <DialogTitle>{selectedIssue.title}</DialogTitle>
                <DialogDescription>
                  Full detail for this grouped link issue, including the original URL and the pages where it was found.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
                <div className="space-y-4">
                  <div className="rounded-2xl border border-border bg-background p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={issueTypeBadgeVariant(selectedIssue.issueTypeKey)}>
                        {selectedIssue.issueTypeLabel}
                      </Badge>
                      <Badge variant={statusBadgeVariant(selectedIssue.status, selectedIssue.issueTypeKey)}>
                        {selectedIssue.statusLabel}
                      </Badge>
                      <Badge variant="outline">{selectedIssue.scope}</Badge>
                    </div>

                    <div className="mt-4 space-y-4">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                          Full URL
                        </p>
                        <div className="mt-2 rounded-2xl border border-border/80 bg-card p-3 text-sm leading-6 text-muted-foreground break-all">
                          {selectedIssue.url}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-2"
                          onClick={() => void copyValue(selectedIssue.url, "URL")}
                        >
                          <Copy className="h-4 w-4" />
                          Copy URL
                        </Button>
                      </div>

                      {selectedIssue.redirectedTo ? (
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                            Redirect target
                          </p>
                          <div className="mt-2 rounded-2xl border border-border/80 bg-card p-3 text-sm leading-6 text-muted-foreground break-all">
                            {selectedIssue.redirectedTo}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl border border-border bg-background p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Response details
                    </p>
                    <div className="mt-3 space-y-3 text-sm text-muted-foreground">
                      <div className="flex items-center justify-between gap-3">
                        <span>Status</span>
                        <Badge variant={statusBadgeVariant(selectedIssue.status, selectedIssue.issueTypeKey)}>
                          {selectedIssue.statusLabel}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>Occurrences</span>
                        <span className="font-medium text-foreground">{selectedIssue.occurrences}</span>
                      </div>
                      <p className="leading-6">
                        {selectedIssue.issueTypeKey === "redirect"
                          ? "This URL is redirecting instead of linking directly to the final destination."
                          : selectedIssue.issueTypeKey === "timeout"
                            ? "The crawl could not get a clean response before timing out."
                            : selectedIssue.issueTypeKey === "server"
                              ? "The destination returned a server-side error and needs investigation."
                              : "The destination did not return a healthy response and should be fixed or replaced."}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border bg-background p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        Found on
                      </p>
                      {selectedIssue.sourcePages[0] ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void copyValue(selectedIssue.sourcePages.join("\n"), "source pages")}
                        >
                          <Copy className="h-4 w-4" />
                          Copy list
                        </Button>
                      ) : null}
                    </div>

                    {selectedIssue.sourcePages.length ? (
                      <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
                        {selectedIssue.sourcePages.map((source) => (
                          <div
                            key={source}
                            className="rounded-2xl border border-border/80 bg-card px-3 py-2 text-sm leading-6 text-muted-foreground break-all"
                          >
                            {source}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-muted-foreground">
                        No source page was recorded for this issue in the latest crawl.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
