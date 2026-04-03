"use client";

import Link from "next/link";
import { PauseCircle, PlayCircle, Plus, Search, Trash2, WandSparkles } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/dashboard/empty-state";
import { MetricTile } from "@/components/dashboard/metric-tile";
import { PageHeader } from "@/components/dashboard/page-header";
import { ScoreRing } from "@/components/dashboard/score-ring";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { Website } from "@/types";
import { fetchJson } from "@/lib/api-client";
import { getFriendlyScanFailureMessage } from "@/lib/scan-errors";
import { useWebsites } from "@/hooks/useWebsites";
import type { ScanResult } from "@/types";

export default function WebsitesPage() {
  const { websites, loading, refetch } = useWebsites();
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
        title="Monitor every client website from one place"
        description="Search, scan, pause, delete, and jump into reports without leaving the dashboard."
        actions={
          <Button asChild>
            <Link href="/dashboard/websites/add">
              <Plus className="mr-2 h-4 w-4" />
              Add website
            </Link>
          </Button>
        }
      />

      <Card>
        <CardContent className="p-5">
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
        <div className="grid gap-6 xl:grid-cols-2 min-[1800px]:grid-cols-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index}>
              <CardContent className="p-6">
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
      ) : filtered.length ? (
        <div className="grid gap-6 xl:grid-cols-2 min-[1800px]:grid-cols-3">
          {filtered.map((website) => {
            const latest = website.latest_scan;
            const isScanning = scanningWebsiteId === website.id;
            const hasValidScan = Boolean(latest && latest.scan_status !== "failed");
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
              <Card key={website.id}>
                <CardContent className="p-6">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex items-center gap-3">
                        <h2 className="font-display text-2xl font-semibold">{website.label}</h2>
                        <Badge variant={website.is_active ? "success" : "outline"}>
                          {website.is_active ? "Active" : "Paused"}
                        </Badge>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">{website.url}</p>
                      <p className="mt-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        {website.schedule?.frequency ?? "weekly"} scans
                      </p>
                    </div>
                    <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
                      <Button asChild variant="outline" size="sm" className="col-span-1">
                        <Link href={`/dashboard/websites/${website.id}`}>View</Link>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => runScan(website.id)}
                        disabled={isPending}
                        className="col-span-1"
                      >
                        <WandSparkles className="mr-2 h-4 w-4" />
                        {isScanning ? "Scanning..." : "Scan now"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => updateWebsite(website.id, { is_active: !website.is_active })}
                        disabled={isPending}
                        className="col-span-1"
                      >
                        {website.is_active ? (
                          <>
                            <PauseCircle className="mr-2 h-4 w-4" />
                            Pause
                          </>
                        ) : (
                          <>
                            <PlayCircle className="mr-2 h-4 w-4" />
                            Resume
                          </>
                        )}
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="col-span-1">
                            <Trash2 className="mr-2 h-4 w-4" />
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

                  <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,220px)_minmax(0,1fr)] min-[1800px]:grid-cols-[minmax(0,236px)_minmax(0,1fr)]">
                    {hasValidScan ? (
                      <ScoreRing
                        label="Performance"
                        score={latest?.performance_score ?? 0}
                        delta={null}
                      />
                    ) : (
                      <div className="flex flex-col justify-between rounded-3xl border border-border bg-background p-6">
                        <div>
                          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Performance</p>
                          <p className="mt-4 font-display text-3xl font-semibold">{latestState.label}</p>
                        </div>
                        <p className="mt-4 text-sm text-muted-foreground">{latestState.description}</p>
                      </div>
                    )}

                    <div className="rounded-3xl border border-border bg-background p-5">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Latest scan</p>
                      {hasValidScan ? (
                        <div className="mt-4 grid gap-3 min-[440px]:grid-cols-2">
                          {[
                            { label: "SEO", value: latest?.seo_score ?? 0 },
                            { label: "Accessibility", value: latest?.accessibility_score ?? 0 },
                            { label: "Best Practices", value: latest?.best_practices_score ?? 0 },
                            {
                              label: "Accessibility violations",
                              value: latest?.accessibility_violations?.length ?? 0
                            }
                          ].map((metric) => (
                            <MetricTile key={metric.label} label={metric.label} value={metric.value} />
                          ))}
                        </div>
                      ) : (
                        <div className="mt-4 rounded-2xl border border-dashed border-border bg-card p-4">
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
                                <WandSparkles className="mr-2 h-4 w-4" />
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
          actionLabel="Add website"
          actionHref="/dashboard/websites/add"
        />
      )}
    </div>
  );
}
