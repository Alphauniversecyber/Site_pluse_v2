"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Download, Mail, Search } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/dashboard/empty-state";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Report } from "@/types";
import { fetchJson } from "@/lib/api-client";
import { useWebsites } from "@/hooks/useWebsites";

export default function ReportsPage() {
  const { websites } = useWebsites();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isPending, startTransition] = useTransition();

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

  const filteredReports = useMemo(
    () =>
      reports.filter((report) => {
        const website = websiteLabels.get(report.website_id);
        const haystack = `${website?.label ?? ""} ${website?.url ?? ""}`.toLowerCase();
        return haystack.includes(search.toLowerCase());
      }),
    [reports, search, websiteLabels]
  );

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
    <div className="space-y-8">
      <PageHeader
        eyebrow="Reports"
        title="White-label report library"
        description="Download or resend generated PDF reports for every client site you monitor."
      />

      <Card>
        <CardContent className="p-5">
          <div className="relative mb-5">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-11"
              placeholder="Search reports by website name or URL"
            />
          </div>

          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="rounded-3xl border border-border bg-background/70 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1 space-y-3">
                      <Skeleton className="h-5 w-40" />
                      <Skeleton className="h-4 w-64 max-w-full" />
                    </div>
                    <Skeleton className="h-7 w-24 rounded-full" />
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-10 w-full rounded-xl" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredReports.length ? (
            <>
              <div className="space-y-4 md:hidden">
                {filteredReports.map((report) => {
                  const website = websiteLabels.get(report.website_id);
                  return (
                    <div key={report.id} className="rounded-3xl border border-border bg-background p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{website?.label ?? report.website_id}</p>
                          <p className="mt-1 break-all text-xs text-muted-foreground">{website?.url}</p>
                        </div>
                        <Badge variant={report.sent_at ? "success" : "outline"}>
                          {report.sent_at ? "Sent" : "Generated"}
                        </Badge>
                      </div>
                      <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                        <p>
                          Generated:{" "}
                          {report.created_at
                            ? new Date(report.created_at).toLocaleString()
                            : new Date(report.sent_at ?? Date.now()).toLocaleString()}
                        </p>
                        <p>Last sent: {report.sent_at ? new Date(report.sent_at).toLocaleString() : "Not yet sent"}</p>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <Button variant="outline" size="sm" onClick={() => downloadReport(report.id)} disabled={isPending}>
                          <Download className="mr-2 h-4 w-4" />
                          Download
                        </Button>
                        <Button size="sm" onClick={() => sendReport(report.id)} disabled={isPending}>
                          <Mail className="mr-2 h-4 w-4" />
                          Send
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Website</TableHead>
                      <TableHead>Generated</TableHead>
                      <TableHead>Last sent</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReports.map((report) => {
                      const website = websiteLabels.get(report.website_id);
                      return (
                        <TableRow key={report.id}>
                          <TableCell>
                            <p className="font-medium">{website?.label ?? report.website_id}</p>
                            <p className="text-xs text-muted-foreground">{website?.url}</p>
                          </TableCell>
                          <TableCell>
                            {report.created_at
                              ? new Date(report.created_at).toLocaleString()
                              : new Date(report.sent_at ?? Date.now()).toLocaleString()}
                          </TableCell>
                          <TableCell>{report.sent_at ? new Date(report.sent_at).toLocaleString() : "Not yet sent"}</TableCell>
                          <TableCell>
                            <Badge variant={report.sent_at ? "success" : "outline"}>
                              {report.sent_at ? "Sent" : "Generated"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-2">
                              <Button variant="outline" size="sm" onClick={() => downloadReport(report.id)} disabled={isPending}>
                                <Download className="mr-2 h-4 w-4" />
                                Download
                              </Button>
                              <Button size="sm" onClick={() => sendReport(report.id)} disabled={isPending}>
                                <Mail className="mr-2 h-4 w-4" />
                                Send
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
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
    </div>
  );
}
