"use client";

import Link from "next/link";
import { ArrowUpRight, PauseCircle, PlayCircle, Plus, Search, Trash2, WandSparkles } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/dashboard/empty-state";
import { MetricTile } from "@/components/dashboard/metric-tile";
import { PageHeader } from "@/components/dashboard/page-header";
import { ScoreRing } from "@/components/dashboard/score-ring";
import { AddWebsiteButton } from "@/components/trial/AddWebsiteButton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { Website } from "@/types";
import { fetchJson } from "@/lib/api-client";
import { buildSiteBusinessImpact } from "@/lib/business-impact";
import { getFriendlyScanFailureMessage } from "@/lib/scan-errors";
import { useWebsites } from "@/hooks/useWebsites";
import type { ScanResult } from "@/types";

export default function WebsitesPage() {
  const { websites, loading, error, refetch } = useWebsites();
  const [search, setSearch] = useState("");
  const [scanningWebsiteId, setScanningWebsiteId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(
    () =>
      websites.filter(
        (website) =>
          website.label.toLowerCase().includes(search.toLowerCase()) ||
          website.url.toLowerCase().includes(search.toLowerCase())
      ),
    [search, websites]
  );

  function runScan(websiteId: string) {
    startTransition(async () => {
      setScanningWebsiteId(websiteId);
      try {
        await fetchJson<ScanResult>("/api/scan/run", {
          method: "POST",
          body: JSON.stringify({ websiteId })
        });
        toast.success("Scan completed and saved.");
        await refetch();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to start scan.");
      } finally {
        setScanningWebsiteId((current) => (current === websiteId ? null : current));
      }
    });
  }

  function updateWebsite(id: string, payload: Partial<Website>) {
    startTransition(async () => {
      try {
        await fetchJson(`/api/websites/${id}`, {
          method: "PATCH",
          body: JSON.stringify(payload)
        });
        toast.success("Website updated.");
        await refetch();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to update website.");
      }
    });
  }

  function deleteWebsite(id: string) {
    startTransition(async () => {
      try {
        await fetchJson(`/api/websites/${id}`, {
          method: "DELETE"
        });
        toast.success("Website deleted.");
        await refetch();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to delete website.");
      }
    });
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Websites"
        title="Protect every client account from one operating board"
        description="See which sites are at risk, where business value is leaking, and what your team should act on next."
        actions={
          <AddWebsiteButton websiteCount={websites.length}>
            <>
              <Plus className="mr-2 h-4 w-4" />
              Add website
            </>
          </AddWebsiteButton>
        }
      />

      <Card>
        <CardContent className="p-5">
          <div className="mb-4 rounded-2xl border border-primary/15 bg-primary/[0.06] px-4 py-3 text-sm leading-7 text-muted-foreground">
            SitePulse is framed here as an account protection workflow, so every website card should help you spot risk, explain impact, and move to the next client action quickly.
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-11"
              placeholder="Search by client name or URL"
            />
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="grid gap-6 [grid-template-columns:repeat(auto-fit,minmax(min(100%,26rem),1fr))] min-[1800px]:[grid-template-columns:repeat(auto-fit,minmax(28rem,1fr))]">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index} className="website-monitor-card h-full">
              <CardContent className="flex h-full flex-col p-6">
                <Skeleton className="h-6 w-1/2" />
                <Skeleton className="mt-4 h-4 w-2/3" />
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <Skeleton className="h-40 w-full" />
                  <Skeleton className="h-40 w-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : error ? (
        <EmptyState
          title="Unable to load websites"
          description={error}
          action={
            <Button type="button" onClick={() => void refetch()}>
              Try again
            </Button>
          }
        />
      ) : filtered.length ? (
        <div className="grid gap-6 [grid-template-columns:repeat(auto-fit,minmax(min(100%,26rem),1fr))] min-[1800px]:[grid-template-columns:repeat(auto-fit,minmax(28rem,1fr))]">
          {filtered.map((website) => {
            const latest = website.latest_scan;
            const isScanning = scanningWebsiteId === website.id;
            const hasValidScan = Boolean(latest && latest.scan_status !== "failed");
            const impact = buildSiteBusinessImpact(latest ?? null);
            const latestState = isScanning
              ? {
                  label: "Scan queued",
                  description: "A fresh scan is running now. New scores will appear when it finishes."
                }
              : latest?.scan_status === "failed"
                ? {
                    label: "Scan failed",
                    description: getFriendlyScanFailureMessage(
                      latest.error_message || "The last scan could not complete successfully."
                    )
                  }
                : !latest
                  ? {
                      label: "Not scanned yet",
                      description: "Run the first scan to generate monitoring scores and report data."
                    }
                  : {
                      label: "Latest scan ready",
                      description: "Current scores reflect the most recent completed scan."
                    };

            return (
              <Card key={website.id} className="website-monitor-card h-full">
                <CardContent className="relative flex h-full flex-col p-6">
                  <div className="relative flex flex-col gap-5">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <h2 className="min-w-0 font-display text-xl font-semibold sm:text-2xl">{website.label}</h2>
                        <Badge variant={website.is_active ? "success" : "outline"}>
                          {website.is_active ? "Active" : "Paused"}
                        </Badge>
                      </div>
                      <p className="mt-2 break-all text-sm text-muted-foreground">{website.url}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-2.5">
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          {website.schedule?.frequency ?? "weekly"} scans
                        </p>
                        {website.broken_links ? (
                          <Badge variant={website.broken_links.broken_links > 0 ? "warning" : "success"}>
                            {website.broken_links.broken_links} broken links
                          </Badge>
                        ) : null}
                        {website.security_headers ? (
                          <Badge variant={website.security_headers.grade === "A" ? "success" : website.security_headers.grade === "B" ? "warning" : "danger"}>
                            Security {website.security_headers.grade}
                          </Badge>
                        ) : null}
                      </div>
                      <div className="mt-4 rounded-2xl border border-primary/12 bg-primary/[0.06] px-3.5 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
                          Business impact
                        </p>
                        <p className="mt-2 text-sm leading-6 text-foreground/90">{impact.headline}</p>
                      </div>
                    </div>

                    <div className="grid w-full gap-2.5 sm:grid-cols-2">
                      <Button
                        asChild
                        variant="outline"
                        className="h-11 rounded-2xl border-border/80 bg-background/75 px-4 text-sm shadow-[0_16px_44px_-34px_rgba(15,23,42,0.82)]"
                      >
                        <Link href={`/dashboard/websites/${website.id}`}>
                          <ArrowUpRight className="h-4 w-4 shrink-0" />
                          View
                        </Link>
                      </Button>
                      <Button
                        variant="default"
                        onClick={() => runScan(website.id)}
                        disabled={isPending}
                        className="h-11 rounded-2xl px-4 text-sm shadow-[0_22px_54px_-34px_rgba(59,130,246,0.82)]"
                      >
                        <WandSparkles className="h-4 w-4 shrink-0" />
                        {isScanning ? "Scanning..." : "Scan now"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => updateWebsite(website.id, { is_active: !website.is_active })}
                        disabled={isPending}
                        className="h-10 rounded-2xl border-border/70 bg-background/55 px-4 text-sm text-foreground/80 hover:text-foreground"
                      >
                        {website.is_active ? (
                          <>
                            <PauseCircle className="h-4 w-4 shrink-0" />
                            Pause
                          </>
                        ) : (
                          <>
                            <PlayCircle className="h-4 w-4 shrink-0" />
                            Resume
                          </>
                        )}
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            className="h-10 rounded-2xl border-border/70 bg-background/55 px-4 text-sm text-foreground/80 hover:text-foreground"
                          >
                            <Trash2 className="h-4 w-4 shrink-0" />
                            Delete
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete {website.label}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This removes the website, its scan history, reports, and schedules. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteWebsite(website.id)}>
                              Delete website
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>

                  <div className="relative mt-6 grid flex-1 gap-4 min-[2200px]:grid-cols-[minmax(0,228px)_minmax(0,1fr)]">
                    {hasValidScan ? (
                      <ScoreRing
                        label="Health Score"
                        score={website.health_score?.overall ?? latest?.performance_score ?? 0}
                        delta={null}
                        statusLabel={
                          website.health_score
                            ? `${website.health_score.breakdown.security}/100 security`
                            : null
                        }
                        className="website-monitor-panel bg-white/88 dark:bg-card"
                      />
                    ) : (
                      <div className="website-monitor-empty flex flex-col justify-between p-6">
                        <div>
                          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Performance</p>
                          <p className="mt-4 font-display text-3xl font-semibold">{latestState.label}</p>
                        </div>
                        <p className="mt-4 text-sm text-muted-foreground">{latestState.description}</p>
                      </div>
                    )}

                    <div className="website-monitor-panel p-5">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Latest scan</p>
                      {hasValidScan ? (
                        <div className="mt-4 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,10.5rem),1fr))]">
                          {[
                            { label: "Performance", shortLabel: "Perf.", value: latest?.performance_score ?? 0 },
                            { label: "SEO", shortLabel: "SEO", value: latest?.seo_score ?? 0 },
                            { label: "Accessibility", shortLabel: "Access.", value: latest?.accessibility_score ?? 0 },
                            { label: "Best Practices", shortLabel: "Best Prac.", value: latest?.best_practices_score ?? 0 },
                            {
                              label: "Accessibility violations",
                              shortLabel: "A11y Issues",
                              value: latest?.accessibility_violations?.length ?? 0
                            }
                          ].map((metric) => (
                            <MetricTile
                              key={metric.label}
                              label={metric.label}
                              shortLabel={metric.shortLabel}
                              value={metric.value}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-white/92 p-4 dark:border-border dark:bg-card">
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="font-medium">{latestState.label}</p>
                              <p className="mt-2 text-sm text-muted-foreground">{latestState.description}</p>
                            </div>
                            {latest?.scan_status === "failed" ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => runScan(website.id)}
                                disabled={isPending}
                                className="shrink-0"
                              >
                                <WandSparkles className="h-4 w-4 shrink-0" />
                                Retry scan
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="No websites match that search"
          description="Try another client name or add a new website to start sending white-label reports automatically."
          action={
            <AddWebsiteButton websiteCount={websites.length}>
              <>
                <Plus className="h-4 w-4" />
                Add website
              </>
            </AddWebsiteButton>
          }
        />
      )}
    </div>
  );
}
