"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";

import { EmptyState } from "@/components/dashboard/empty-state";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useScans } from "@/hooks/useScans";
import { useUser } from "@/hooks/useUser";

export default function WebsiteScansPage({ params }: { params: { id: string } }) {
  const [page, setPage] = useState(1);
  const { scans, total, pageSize, loading } = useScans(params.id, page, 10);
  const { user } = useUser();

  const csv = useMemo(() => {
    const rows = [
      ["Date", "Performance", "SEO", "Accessibility", "Best Practices", "Violations"],
      ...scans.map((scan) => [
        new Date(scan.scanned_at).toISOString(),
        String(scan.performance_score),
        String(scan.seo_score),
        String(scan.accessibility_score),
        String(scan.best_practices_score),
        String(scan.accessibility_violations?.length ?? 0)
      ])
    ];

    return rows.map((row) => row.join(",")).join("\n");
  }, [scans]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Scan history"
        title="Full scan history"
        description="Paginated history for this site, including performance, SEO, accessibility, and best-practice scores."
        actions={
          user?.plan === "agency" ? (
            <Button
              variant="outline"
              onClick={() => {
                const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = "sitepulse-scan-history.csv";
                link.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          ) : null
        }
      />

      <Card>
        <CardContent className="p-6">
          {loading ? (
            <p className="text-muted-foreground">Loading scan history...</p>
          ) : scans.length ? (
            <>
              <div className="space-y-4 md:hidden">
                {scans.map((scan) => (
                  <div key={scan.id} className="rounded-3xl border border-border bg-background p-4">
                    <p className="font-medium">
                      {new Date(scan.scanned_at).toLocaleString("en-US", {
                        dateStyle: "medium",
                        timeStyle: "short"
                      })}
                    </p>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      {[
                        ["Performance", scan.performance_score],
                        ["SEO", scan.seo_score],
                        ["Accessibility", scan.accessibility_score],
                        ["Best Practices", scan.best_practices_score],
                        ["Violations", scan.accessibility_violations?.length ?? 0]
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-2xl border border-border bg-card p-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
                          <p className="mt-2 text-xl font-semibold">{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Scanned at</TableHead>
                      <TableHead>Performance</TableHead>
                      <TableHead>SEO</TableHead>
                      <TableHead>Accessibility</TableHead>
                      <TableHead>Best Practices</TableHead>
                      <TableHead>Violations</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scans.map((scan) => (
                      <TableRow key={scan.id}>
                        <TableCell>
                          {new Date(scan.scanned_at).toLocaleString("en-US", {
                            dateStyle: "medium",
                            timeStyle: "short"
                          })}
                        </TableCell>
                        <TableCell>{scan.performance_score}</TableCell>
                        <TableCell>{scan.seo_score}</TableCell>
                        <TableCell>{scan.accessibility_score}</TableCell>
                        <TableCell>{scan.best_practices_score}</TableCell>
                        <TableCell>{scan.accessibility_violations?.length ?? 0}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing page {page} of {Math.max(1, Math.ceil(total / pageSize))}
                </p>
                <div className="flex gap-3">
                  <Button variant="outline" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    disabled={page >= Math.ceil(total / pageSize)}
                    onClick={() => setPage((value) => value + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <EmptyState
              title="No scans yet"
              description="Run the first scan from the website detail page to start building performance history."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
