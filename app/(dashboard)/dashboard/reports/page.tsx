"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { ArrowUpRight, Download, Mail, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/dashboard/empty-state";
import { PageHeader } from "@/components/dashboard/page-header";
import { TrialPaywall } from "@/components/trial/TrialPaywall";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTrialPaywall } from "@/hooks/useTrialPaywall";
import { useUser } from "@/hooks/useUser";
import { useWebsites } from "@/hooks/useWebsites";
import { fetchJson } from "@/lib/api-client";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { Report } from "@/types";

function getReportTimestamp(report: Report) {
  return report.created_at ?? report.sent_at ?? null;
}

function splitDateParts(value: string | null) {
  if (!value) {
    return {
      date: "Not available",
      time: "",
      relative: ""
    };
  }

  const parsed = new Date(value);

  return {
    date: new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    }).format(parsed),
    time: new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit"
    }).format(parsed),
    relative: formatRelativeTime(parsed)
  };
}

function reportStatusMeta(report: Report) {
  if (report.sent_at) {
    return {
      label: "Sent",
      helper: "Delivered to recipients",
      variant: "success" as const
    };
  }

  return {
    label: "Generated",
    helper: "Ready to email",
    variant: "outline" as const
  };
}

function MetricPill({
  label,
  value,
  tone = "default"
}: {
  label: string;
  value: string;
  tone?: "default" | "primary";
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-3",
        tone === "primary"
          ? "border-primary/20 bg-primary/[0.08] shadow-[0_18px_44px_-34px_rgba(59,130,246,0.28)] dark:shadow-[0_18px_44px_-34px_rgba(59,130,246,0.45)]"
          : "border-slate-200/90 bg-white/78 shadow-[0_16px_38px_-30px_rgba(15,23,42,0.12)] dark:border-border/80 dark:bg-background/60 dark:shadow-none"
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-2xl font-semibold">{value}</p>
    </div>
  );
}

export default function ReportsPage() {
  const { websites } = useWebsites({ view: "summary" });
  const { user } = useUser();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isPending, startTransition] = useTransition();
  const { paywallFeature, isExpired, closePaywall, requireAccess } = useTrialPaywall(user);

  const websiteLabels = useMemo(
    () =>
      new Map(
        websites.map((website) => [
          website.id,
          {
            label: website.label,
            url: website.url
          }
        ])
      ),
    [websites]
  );

  const refetch = async () => {
    setLoading(true);
    try {
      const data = await fetchJson<Report[]>("/api/reports");
      setReports(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load reports.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refetch();
  }, []);

  const filteredReports = useMemo(() => {
    const query = search.trim().toLowerCase();

    return reports.filter((report) => {
      const website = websiteLabels.get(report.website_id);
      const haystack = `${website?.label ?? ""} ${website?.url ?? ""}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [reports, search, websiteLabels]);

  const summary = useMemo(() => {
    const generatedOnly = reports.filter((report) => !report.sent_at).length;
    const sent = reports.filter((report) => Boolean(report.sent_at)).length;
    const latestActivity = [...reports]
      .map((report) => getReportTimestamp(report))
      .filter((value): value is string => Boolean(value))
      .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] ?? null;

    return {
      total: reports.length,
      generatedOnly,
      sent,
      latestActivity
    };
  }, [reports]);

  const downloadReport = (id: string) =>
    startTransition(async () => {
      try {
        const result = await fetchJson<{ signedUrl: string }>(`/api/reports/${id}`);
        window.open(result.signedUrl, "_blank", "noopener,noreferrer");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to download report.");
      }
    });

  const sendReport = (id: string) =>
    startTransition(async () => {
      try {
        const result = await fetchJson<{ deliveries: Array<{ recipient: string; messageId: string }> }>("/api/reports/send", {
          method: "POST",
          body: JSON.stringify({
            reportId: id
          })
        });
        toast.success(
          result.deliveries.length === 1
            ? `Report emailed to ${result.deliveries[0]?.recipient}.`
            : `Report emailed to ${result.deliveries.length} recipients.`
        );
        await refetch();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to send report.");
      }
    });

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        eyebrow="Reports"
        title="Client delivery and retention library"
        description="Keep every client-facing report ready to send, easy to prove, and simple to use in follow-up conversations."
      />

      <Card className="relative overflow-hidden border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))] shadow-[0_28px_90px_-44px_rgba(15,23,42,0.16),0_0_0_1px_rgba(148,163,184,0.14)] dark:border-white/8 dark:bg-[linear-gradient(180deg,rgba(30,41,59,0.96),rgba(15,23,42,0.96))] dark:shadow-[0_28px_90px_-44px_rgba(15,23,42,0.9),0_0_0_1px_rgba(96,165,250,0.05)]">
        <div className="pointer-events-none absolute inset-px rounded-[1.45rem] border border-slate-200/70 dark:border-white/6" />
        <div className="pointer-events-none absolute left-0 top-0 h-28 w-56 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.10),transparent_72%)] blur-2xl dark:bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.12),transparent_72%)]" />

        <CardHeader className="relative gap-5 pb-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <CardTitle>Report queue</CardTitle>
              <CardDescription>
                Keep downloads, send actions, and delivery status aligned so the library feels clean even as it grows.
              </CardDescription>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[520px]">
              <MetricPill label="Total reports" value={`${summary.total}`} tone="primary" />
              <MetricPill label="Ready to send" value={`${summary.generatedOnly}`} />
              <MetricPill
                label="Latest activity"
                value={summary.latestActivity ? formatRelativeTime(summary.latestActivity) : "None yet"}
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="relative space-y-5 p-5 pt-0 sm:p-6 sm:pt-0">
          <div className="rounded-[1.75rem] border border-slate-200/90 bg-slate-50/92 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] sm:p-5 dark:border-border/80 dark:bg-background/60 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-xl">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">Library controls</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Search by website and manage report delivery as a clean client-success workflow instead of a cluttered file list.
                </p>
              </div>

              <div className="w-full xl:max-w-[34rem]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="h-14 rounded-2xl border-slate-200/90 bg-white/92 pl-11 shadow-[0_16px_38px_-28px_rgba(15,23,42,0.12)] dark:border-border/80 dark:bg-card/70 dark:shadow-none"
                    placeholder="Search reports by website name or URL"
                  />
                </div>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="rounded-[1.75rem] border border-slate-200/90 bg-white/90 p-5 shadow-[0_18px_48px_-34px_rgba(15,23,42,0.14)] dark:border-border/80 dark:bg-background/70 dark:shadow-none">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1 space-y-3">
                      <Skeleton className="h-6 w-40" />
                      <Skeleton className="h-4 w-72 max-w-full" />
                    </div>
                    <Skeleton className="h-10 w-36 rounded-2xl" />
                  </div>
                  <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.7fr_0.8fr]">
                    {Array.from({ length: 5 }).map((_, metricIndex) => (
                      <Skeleton key={metricIndex} className="h-16 w-full rounded-2xl" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : filteredReports.length ? (
            <>
              <div className="space-y-4 lg:hidden">
                {filteredReports.map((report) => {
                  const website = websiteLabels.get(report.website_id);
                  const createdMeta = splitDateParts(getReportTimestamp(report));
                  const sentMeta = splitDateParts(report.sent_at);
                  const status = reportStatusMeta(report);

                  return (
                    <div key={report.id} className="rounded-[1.75rem] border border-border/80 bg-background p-4 sm:p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-lg font-semibold">{website?.label ?? report.website_id}</p>
                            <Badge variant={status.variant}>{status.label}</Badge>
                          </div>
                          <p className="mt-2 truncate text-sm text-muted-foreground" title={website?.url}>
                            {website?.url ?? "No website URL available"}
                          </p>
                        </div>
                        <div className="rounded-full border border-primary/20 bg-primary/10 p-2 text-primary">
                          <Sparkles className="h-4 w-4" />
                        </div>
                      </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-slate-200/90 bg-slate-50/88 p-3 dark:border-border/70 dark:bg-card/60">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Generated</p>
                          <p className="mt-2 font-medium">{createdMeta.date}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{createdMeta.time}</p>
                        </div>
                        <div className="rounded-2xl border border-slate-200/90 bg-slate-50/88 p-3 dark:border-border/70 dark:bg-card/60">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Last sent</p>
                          <p className="mt-2 font-medium">{report.sent_at ? sentMeta.date : "Not yet sent"}</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {report.sent_at ? sentMeta.time : status.helper}
                          </p>
                        </div>
                      </div>

                      <div className="mt-5 grid gap-2 sm:grid-cols-2">
                        <Button
                          variant="outline"
                          className="h-11 justify-center rounded-2xl"
                          onClick={() =>
                            requireAccess("download_report", () => downloadReport(report.id))
                          }
                          disabled={isPending}
                        >
                          <Download className="h-4 w-4" />
                          Download PDF
                        </Button>
                        <Button
                          className="h-11 justify-center rounded-2xl"
                          onClick={() => sendReport(report.id)}
                          disabled={isPending}
                        >
                          <Mail className="h-4 w-4" />
                          Send report
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="hidden lg:block">
                <div className="overflow-hidden rounded-[1.75rem] border border-slate-200/90 bg-white/90 shadow-[0_18px_52px_-34px_rgba(15,23,42,0.16)] dark:border-border/80 dark:bg-background/70 dark:shadow-none">
                  <Table>
                    <TableHeader className="bg-slate-50/90 dark:bg-card/70">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-[28%]">Website</TableHead>
                        <TableHead className="w-[18%]">Generated</TableHead>
                        <TableHead className="w-[18%]">Last sent</TableHead>
                        <TableHead className="w-[16%]">Status</TableHead>
                        <TableHead className="w-[20%] text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredReports.map((report) => {
                        const website = websiteLabels.get(report.website_id);
                        const createdMeta = splitDateParts(getReportTimestamp(report));
                        const sentMeta = splitDateParts(report.sent_at);
                        const status = reportStatusMeta(report);

                        return (
                          <TableRow
                            key={report.id}
                            className="border-slate-200/90 bg-white/88 transition-[background-color,border-color] duration-200 hover:bg-slate-50/96 dark:border-border/80 dark:bg-background/60 dark:hover:bg-card/50"
                          >
                            <TableCell className="py-6">
                              <div className="min-w-0">
                                <div className="flex items-center gap-3">
                                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 text-primary shadow-[0_16px_34px_-26px_rgba(59,130,246,0.65)]">
                                    <Sparkles className="h-4 w-4" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="truncate text-lg font-semibold">{website?.label ?? report.website_id}</p>
                                    <p className="mt-1 truncate text-sm text-muted-foreground" title={website?.url}>
                                      {website?.url ?? "No website URL available"}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </TableCell>

                            <TableCell className="py-6">
                              <div className="space-y-1">
                                <p className="font-medium text-foreground">{createdMeta.date}</p>
                                <p className="text-sm text-muted-foreground">{createdMeta.time}</p>
                                {createdMeta.relative ? (
                                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{createdMeta.relative}</p>
                                ) : null}
                              </div>
                            </TableCell>

                            <TableCell className="py-6">
                              <div className="space-y-1">
                                <p className="font-medium text-foreground">
                                  {report.sent_at ? sentMeta.date : "Not yet sent"}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {report.sent_at ? sentMeta.time : status.helper}
                                </p>
                                {report.sent_at ? (
                                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                                    {sentMeta.relative}
                                  </p>
                                ) : null}
                              </div>
                            </TableCell>

                            <TableCell className="py-6">
                              <div className="space-y-2">
                                <Badge variant={status.variant} className="min-w-[7.5rem] justify-center">
                                  {status.label}
                                </Badge>
                                <p className="text-sm text-muted-foreground">{status.helper}</p>
                              </div>
                            </TableCell>

                            <TableCell className="py-6">
                              <div className="ml-auto flex w-[10.5rem] flex-col items-stretch gap-2">
                                <Button
                                  variant="outline"
                                  className="h-11 justify-between rounded-2xl px-4"
                                  onClick={() =>
                                    requireAccess("download_report", () => downloadReport(report.id))
                                  }
                                  disabled={isPending}
                                >
                                  <span className="flex items-center gap-2">
                                    <Download className="h-4 w-4" />
                                    Download
                                  </span>
                                  <ArrowUpRight className="h-4 w-4" />
                                </Button>
                                <Button
                                  className="h-11 justify-between rounded-2xl px-4"
                                  onClick={() => sendReport(report.id)}
                                  disabled={isPending}
                                >
                                  <span className="flex items-center gap-2">
                                    <Mail className="h-4 w-4" />
                                    Send
                                  </span>
                                  <ArrowUpRight className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </>
          ) : (
            <EmptyState
              title={reports.length ? "No reports match that search" : "No reports generated yet"}
              description={
                reports.length
                  ? "Try another website name or clear the search to browse your full report library."
                  : "Run a scan and generate your first PDF to start building a reusable library of client-ready reports."
              }
            />
          )}
        </CardContent>
      </Card>
      <TrialPaywall
        isOpen={paywallFeature !== null}
        onClose={closePaywall}
        feature={paywallFeature ?? "download_report"}
        isExpired={isExpired}
      />
    </div>
  );
}
