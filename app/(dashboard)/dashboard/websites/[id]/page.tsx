"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { AlertTriangle, ArrowUpRight, FileDown, Mail, ShieldAlert, WandSparkles } from "lucide-react";
import { toast } from "sonner";

import { DeviceScoreChart } from "@/components/charts/device-score-chart";
import { ScoreTrendChart } from "@/components/charts/score-trend-chart";
import { EmptyState } from "@/components/dashboard/empty-state";
import { PageHeader } from "@/components/dashboard/page-header";
import { ScoreRing } from "@/components/dashboard/score-ring";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { ScanResult, Website } from "@/types";
import { fetchJson } from "@/lib/api-client";
import { getFriendlyScanFailureMessage } from "@/lib/scan-errors";

type WebsiteDetailResponse = Website & {
  scans: ScanResult[];
};

export default function WebsiteDetailPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<WebsiteDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const refetch = async () => {
    setLoading(true);
    try {
      const response = await fetchJson<WebsiteDetailResponse>(`/api/websites/${params.id}`);
      setData(response);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load website.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refetch();
  }, [params.id]);

  const currentScan = data?.scans?.[0] ?? null;
  const previousScan = data?.scans?.[1] ?? null;
  const currentScanFailed = currentScan?.scan_status === "failed";
  const scoreDelta =
    currentScan && previousScan ? currentScan.performance_score - previousScan.performance_score : null;

  const accessibilityViolations = useMemo(
    () => currentScan?.accessibility_violations ?? [],
    [currentScan]
  );

  const runScan = () =>
    startTransition(async () => {
      try {
        await fetchJson<ScanResult>("/api/scan/run", {
          method: "POST",
          body: JSON.stringify({
            websiteId: params.id
          })
        });
        toast.success("Manual scan complete.");
        await refetch();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to run scan.");
      }
    });

  const generateReport = () =>
    startTransition(async () => {
      if (!currentScan) {
        toast.error("Run a scan first.");
        return;
      }

      try {
        await fetchJson("/api/reports/generate", {
          method: "POST",
          body: JSON.stringify({
            websiteId: params.id,
            scanId: currentScan.id
          })
        });
        toast.success("PDF report generated.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to generate report.");
      }
    });

  const emailReport = () =>
    startTransition(async () => {
      if (!currentScan) {
        toast.error("Run a scan first.");
        return;
      }

      try {
        const report = await fetchJson<{ id: string }>("/api/reports/generate", {
          method: "POST",
          body: JSON.stringify({
            websiteId: params.id,
            scanId: currentScan.id
          })
        });

        const result = await fetchJson<{ deliveries: Array<{ recipient: string; messageId: string }> }>("/api/reports/send", {
          method: "POST",
          body: JSON.stringify({
            reportId: report.id
          })
        });

        toast.success(
          result.deliveries.length === 1
            ? `Report emailed to ${result.deliveries[0]?.recipient}.`
            : `Report emailed to ${result.deliveries.length} recipients.`
        );
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to email report.");
      }
    });

  if (loading) {
    return (
      <div className="space-y-6 sm:space-y-8">
        <Skeleton className="h-16 w-2/3" />
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-40 w-full sm:h-64" />
          ))}
        </div>
        <Skeleton className="h-[240px] w-full sm:h-[340px]" />
      </div>
    );
  }

  if (!data) {
    return (
      <EmptyState
        title="Website not found"
        description="This website may have been removed or you may no longer have access to it."
        actionLabel="Back to websites"
        actionHref="/dashboard/websites"
      />
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        eyebrow="Website detail"
        title={data.label}
        description={data.url}
        actions={
          <div className="grid w-full gap-3 sm:grid-cols-2 xl:w-auto xl:grid-cols-3">
            <Button variant="outline" onClick={runScan} disabled={isPending} className="h-11 w-full justify-center sm:h-12">
              <WandSparkles className="h-4 w-4" />
              Run scan
            </Button>
            <Button variant="outline" onClick={generateReport} disabled={isPending} className="h-11 w-full justify-center sm:h-12">
              <FileDown className="h-4 w-4" />
              Generate PDF
            </Button>
            <Button onClick={emailReport} disabled={isPending} className="h-11 w-full justify-center sm:h-12 sm:col-span-2 xl:col-span-1">
              <Mail className="h-4 w-4" />
              Email report
            </Button>
          </div>
        }
      />

      {currentScan ? (
        <>
          {currentScanFailed ? (
            <Card>
              <CardHeader>
                <CardTitle>Latest scan failed</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-4 rounded-3xl border border-dashed border-border bg-background p-4 sm:p-5 md:flex-row md:items-start md:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500">
                      <AlertTriangle className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium">This site could not be scanned</p>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                        {getFriendlyScanFailureMessage(currentScan.error_message)}
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" onClick={runScan} disabled={isPending} className="h-11 w-full shrink-0 sm:w-auto">
                    <WandSparkles className="mr-2 h-4 w-4" />
                    Retry scan
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                <ScoreRing label="Performance" score={currentScan.performance_score} delta={scoreDelta} compact />
                <ScoreRing
                  label="SEO"
                  score={currentScan.seo_score}
                  delta={previousScan ? currentScan.seo_score - previousScan.seo_score : null}
                  compact
                />
                <ScoreRing
                  label="Accessibility"
                  score={currentScan.accessibility_score}
                  delta={previousScan ? currentScan.accessibility_score - previousScan.accessibility_score : null}
                  compact
                />
                <ScoreRing
                  label="Best Practices"
                  score={currentScan.best_practices_score}
                  delta={previousScan ? currentScan.best_practices_score - previousScan.best_practices_score : null}
                  compact
                />
              </div>

              <div className="grid gap-4 sm:gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                <Card>
                  <CardHeader className="pb-3 sm:pb-6">
                    <CardTitle>Score trend (last 30 days)</CardTitle>
                  </CardHeader>
                  <CardContent className="px-2 pb-3 pt-0 sm:px-6 sm:pb-6">
                    <ScoreTrendChart scans={data.scans.slice(0, 30)} />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3 sm:pb-6">
                    <CardTitle>Mobile vs desktop</CardTitle>
                  </CardHeader>
                  <CardContent className="px-2 pb-3 pt-0 sm:px-6 sm:pb-6">
                    <DeviceScoreChart scan={currentScan} />
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader className="pb-3 sm:pb-6">
                    <CardTitle>Core Web Vitals</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-3 px-4 pb-4 pt-0 sm:px-6 sm:pb-6 md:grid-cols-2">
                    {[
                      ["Largest Contentful Paint", `${Math.round(currentScan.lcp ?? 0)} ms`],
                      ["First Input Delay", `${Math.round(currentScan.fid ?? 0)} ms`],
                      ["Cumulative Layout Shift", `${currentScan.cls ?? 0}`],
                      ["Total Blocking Time", `${Math.round(currentScan.tbt ?? 0)} ms`]
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-2xl border border-border bg-background p-3 sm:p-4">
                        <p className="text-[10px] uppercase leading-5 tracking-[0.16em] text-muted-foreground sm:text-xs sm:tracking-[0.18em]">
                          {label}
                        </p>
                        <p className="mt-1.5 font-display text-xl font-semibold sm:mt-2 sm:text-2xl">{value}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3 sm:pb-6">
                    <CardTitle>Accessibility violations</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 px-4 pb-4 pt-0 sm:px-6 sm:pb-6">
                    {accessibilityViolations.length ? (
                      accessibilityViolations.slice(0, 8).map((violation, index) => (
                        <div key={index} className="rounded-2xl border border-border bg-background p-3 sm:p-4">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <p className="font-medium leading-6">
                              {String(
                                (violation.help as string | undefined) ??
                                  (violation.message as string | undefined) ??
                                  "Accessibility issue"
                              )}
                            </p>
                            <Badge variant="warning" className="self-start">
                              {String(
                                (violation.severity as string | undefined) ??
                                  (violation.impact as string | undefined) ??
                                  "medium"
                              )}
                            </Badge>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="rounded-2xl border border-border bg-background p-3 text-sm text-muted-foreground sm:p-4">
                        No accessibility violations recorded on the latest scan.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}

          <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-3 sm:pb-6">
                <CardTitle>Issues found</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 px-4 pb-4 pt-0 sm:px-6 sm:pb-6">
                {currentScan.issues.length ? (
                  currentScan.issues.map((issue) => (
                    <div key={issue.id} className="rounded-2xl border border-border bg-background p-3 sm:p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500 sm:h-10 sm:w-10 sm:rounded-2xl">
                            <AlertTriangle className="h-[18px] w-[18px] sm:h-5 sm:w-5" />
                          </div>
                          <div>
                            <p className="font-medium">{issue.title}</p>
                            <p className="mt-2 text-sm leading-6 text-muted-foreground">{issue.description}</p>
                          </div>
                        </div>
                        <Badge
                          variant={issue.severity === "high" ? "danger" : issue.severity === "medium" ? "warning" : "outline"}
                          className="self-start"
                        >
                          {issue.severity}
                        </Badge>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="rounded-2xl border border-border bg-background p-3 text-sm text-muted-foreground sm:p-4">
                    No notable issues were found in the latest scan.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3 sm:pb-6">
                <CardTitle>Recommendations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 px-4 pb-4 pt-0 sm:px-6 sm:pb-6">
                {currentScan.recommendations.length ? (
                  currentScan.recommendations.map((recommendation) => (
                    <div key={recommendation.id} className="rounded-2xl border border-border bg-background p-3 sm:p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary sm:h-10 sm:w-10 sm:rounded-2xl">
                            <ShieldAlert className="h-[18px] w-[18px] sm:h-5 sm:w-5" />
                          </div>
                          <div>
                            <p className="font-medium">{recommendation.title}</p>
                            <p className="mt-2 text-sm leading-6 text-muted-foreground">{recommendation.description}</p>
                            {recommendation.link ? (
                              <a
                                href={recommendation.link}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                              >
                                Open guidance
                                <ArrowUpRight className="h-4 w-4" />
                              </a>
                            ) : null}
                          </div>
                        </div>
                        <Badge
                          variant={recommendation.priority === "high" ? "danger" : recommendation.priority === "medium" ? "warning" : "outline"}
                          className="self-start"
                        >
                          {recommendation.priority}
                        </Badge>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="rounded-2xl border border-border bg-background p-3 text-sm text-muted-foreground sm:p-4">
                    No extra recommendations were generated for this scan.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3 sm:pb-6">
              <CardTitle>Recent scan history</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 px-4 pb-4 pt-0 sm:px-6 sm:pb-6">
              {data.scans.slice(0, 5).map((scan) => (
                <div key={scan.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-background p-3 sm:gap-4 sm:p-4 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {new Date(scan.scanned_at).toLocaleString("en-US", {
                        dateStyle: "medium",
                        timeStyle: "short"
                      })}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {scan.accessibility_violations?.length ?? 0} accessibility issue(s)
                    </p>
                  </div>
                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
                    <Badge variant={scan.performance_score >= 90 ? "success" : scan.performance_score >= 50 ? "warning" : "danger"}>
                      Performance {scan.performance_score}
                    </Badge>
                    <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
                      <Link href={`/dashboard/websites/${params.id}/scans`}>Full history</Link>
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="No scans yet"
          description="Run the first scan to generate scores, accessibility checks, and your first white-label report."
        />
      )}
    </div>
  );
}
