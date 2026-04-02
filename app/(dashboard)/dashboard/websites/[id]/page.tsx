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
        await fetchJson("/api/scan/run", {
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

        await fetchJson("/api/reports/send", {
          method: "POST",
          body: JSON.stringify({
            reportId: report.id
          })
        });

        toast.success("Report emailed.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to email report.");
      }
    });

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16 w-2/3" />
        <div className="grid gap-6 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-64 w-full" />
          ))}
        </div>
        <Skeleton className="h-[340px] w-full" />
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
    <div className="space-y-8">
      <PageHeader
        eyebrow="Website detail"
        title={data.label}
        description={data.url}
        actions={
          <>
            <Button variant="outline" onClick={runScan} disabled={isPending}>
              <WandSparkles className="mr-2 h-4 w-4" />
              Run scan
            </Button>
            <Button variant="outline" onClick={generateReport} disabled={isPending}>
              <FileDown className="mr-2 h-4 w-4" />
              Generate PDF
            </Button>
            <Button onClick={emailReport} disabled={isPending}>
              <Mail className="mr-2 h-4 w-4" />
              Email report
            </Button>
          </>
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
                <div className="flex flex-col gap-4 rounded-3xl border border-dashed border-border bg-background p-5 md:flex-row md:items-start md:justify-between">
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
                  <Button variant="outline" onClick={runScan} disabled={isPending} className="shrink-0">
                    <WandSparkles className="mr-2 h-4 w-4" />
                    Retry scan
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid gap-6 xl:grid-cols-4">
                <ScoreRing label="Performance" score={currentScan.performance_score} delta={scoreDelta} />
                <ScoreRing
                  label="SEO"
                  score={currentScan.seo_score}
                  delta={previousScan ? currentScan.seo_score - previousScan.seo_score : null}
                />
                <ScoreRing
                  label="Access"
                  score={currentScan.accessibility_score}
                  delta={previousScan ? currentScan.accessibility_score - previousScan.accessibility_score : null}
                />
                <ScoreRing
                  label="Best"
                  score={currentScan.best_practices_score}
                  delta={previousScan ? currentScan.best_practices_score - previousScan.best_practices_score : null}
                />
              </div>

              <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                <Card>
                  <CardHeader>
                    <CardTitle>Score trend (last 30 days)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScoreTrendChart scans={data.scans.slice(0, 30)} />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Mobile vs desktop</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <DeviceScoreChart scan={currentScan} />
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Core Web Vitals</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2">
                    {[
                      ["Largest Contentful Paint", `${Math.round(currentScan.lcp ?? 0)} ms`],
                      ["First Input Delay", `${Math.round(currentScan.fid ?? 0)} ms`],
                      ["Cumulative Layout Shift", `${currentScan.cls ?? 0}`],
                      ["Total Blocking Time", `${Math.round(currentScan.tbt ?? 0)} ms`]
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-2xl border border-border bg-background p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
                        <p className="mt-2 font-display text-2xl font-semibold">{value}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Accessibility violations</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {accessibilityViolations.length ? (
                      accessibilityViolations.slice(0, 8).map((violation, index) => (
                        <div key={index} className="rounded-2xl border border-border bg-background p-4">
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-medium">
                              {String(
                                (violation.help as string | undefined) ??
                                  (violation.message as string | undefined) ??
                                  "Accessibility issue"
                              )}
                            </p>
                            <Badge variant="warning">
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
                      <p className="rounded-2xl border border-border bg-background p-4 text-sm text-muted-foreground">
                        No accessibility violations recorded on the latest scan.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Issues found</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {currentScan.issues.length ? (
                  currentScan.issues.map((issue) => (
                    <div key={issue.id} className="rounded-2xl border border-border bg-background p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500">
                            <AlertTriangle className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-medium">{issue.title}</p>
                            <p className="mt-2 text-sm leading-6 text-muted-foreground">{issue.description}</p>
                          </div>
                        </div>
                        <Badge variant={issue.severity === "high" ? "danger" : issue.severity === "medium" ? "warning" : "outline"}>
                          {issue.severity}
                        </Badge>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="rounded-2xl border border-border bg-background p-4 text-sm text-muted-foreground">
                    No notable issues were found in the latest scan.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recommendations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {currentScan.recommendations.length ? (
                  currentScan.recommendations.map((recommendation) => (
                    <div key={recommendation.id} className="rounded-2xl border border-border bg-background p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                            <ShieldAlert className="h-5 w-5" />
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
                        <Badge variant={recommendation.priority === "high" ? "danger" : recommendation.priority === "medium" ? "warning" : "outline"}>
                          {recommendation.priority}
                        </Badge>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="rounded-2xl border border-border bg-background p-4 text-sm text-muted-foreground">
                    No extra recommendations were generated for this scan.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent scan history</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.scans.slice(0, 5).map((scan) => (
                <div key={scan.id} className="flex flex-col gap-4 rounded-2xl border border-border bg-background p-4 md:flex-row md:items-center md:justify-between">
                  <div>
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
                  <div className="flex items-center gap-3">
                    <Badge variant={scan.performance_score >= 90 ? "success" : scan.performance_score >= 50 ? "warning" : "danger"}>
                      Performance {scan.performance_score}
                    </Badge>
                    <Button asChild variant="outline" size="sm">
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
