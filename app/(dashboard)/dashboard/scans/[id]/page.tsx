import Link from "next/link";
import { ArrowRight, FileText, Gauge, Globe2 } from "lucide-react";

import { EmptyState } from "@/components/dashboard/empty-state";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createSupabaseServerClient, requireAuthenticatedUser } from "@/lib/supabase-server";
import { formatDateTime, formatRelativeTime } from "@/lib/utils";
import type { ScanResult, Website } from "@/types";

function compactUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function tone(score: number) {
  if (score >= 90) {
    return "success" as const;
  }

  if (score >= 50) {
    return "warning" as const;
  }

  return "danger" as const;
}

export default async function DashboardScanDetailPage({ params }: { params: { id: string } }) {
  const { profile } = await requireAuthenticatedUser();
  const supabase = createSupabaseServerClient();

  const { data: scan } = await supabase
    .from("scan_results")
    .select("*")
    .eq("id", params.id)
    .single<ScanResult>();

  if (!scan) {
    return (
      <EmptyState
        title="Scan not found"
        description="We couldn't find that saved scan in your workspace."
      />
    );
  }

  const { data: website } = await supabase
    .from("websites")
    .select("*")
    .eq("id", scan.website_id)
    .eq("user_id", profile.id)
    .single<Website>();

  if (!website) {
    return (
      <EmptyState
        title="Scan not available"
        description="This scan is not available in your account."
      />
    );
  }

  const summaryMetrics = [
    { label: "Performance", value: scan.performance_score },
    { label: "SEO", value: scan.seo_score },
    { label: "Accessibility", value: scan.accessibility_score },
    { label: "Best Practices", value: scan.best_practices_score }
  ] as const;

  const issues = (scan.issues ?? []).slice(0, 6);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Saved scan"
        title={website.label}
        description={`This scan was saved to your workspace and is ready for deeper review, reporting, and follow-up.`}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href={`/dashboard/websites/${website.id}`}>
                Open website
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild>
              <Link href="/dashboard/reports">
                My reports
                <FileText className="h-4 w-4" />
              </Link>
            </Button>
          </>
        }
      />

      <Card>
        <CardContent className="grid gap-5 p-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant={scan.scan_status === "failed" ? "danger" : "success"}>
                {scan.scan_status === "failed" ? "Scan failed" : "Scan complete"}
              </Badge>
              <Badge variant="outline">{compactUrl(website.url)}</Badge>
            </div>
            <p className="mt-4 text-lg font-semibold">Saved on {formatDateTime(scan.scanned_at)}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {scan.scanned_at ? `Last updated ${formatRelativeTime(scan.scanned_at)}.` : null} Use this result to jump into the full website workspace or move straight into client reporting.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {summaryMetrics.map((metric) => (
              <div key={metric.label} className="rounded-3xl border border-border bg-card p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  {metric.label}
                </p>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="font-display text-4xl font-semibold">{metric.value}</p>
                  <Badge variant={tone(metric.value)}>{metric.value >= 90 ? "Excellent" : metric.value >= 50 ? "Needs attention" : "Critical"}</Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
                First findings
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                The highest-priority issues detected in this saved scan.
              </p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Gauge className="h-5 w-5" />
            </div>
          </div>

          {issues.length ? (
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {issues.map((issue) => (
                <div key={issue.id} className="rounded-3xl border border-border bg-background p-4">
                  <div className="flex items-center gap-2">
                    <Badge variant={issue.severity === "high" ? "danger" : issue.severity === "medium" ? "warning" : "outline"}>
                      {issue.severity}
                    </Badge>
                    {issue.metric ? (
                      <span className="text-xs text-muted-foreground">{issue.metric}</span>
                    ) : null}
                  </div>
                  <p className="mt-3 font-semibold">{issue.title}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{issue.description}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-3xl border border-dashed border-border bg-background/70 p-6 text-center">
              <Globe2 className="mx-auto h-8 w-8 text-primary" />
              <p className="mt-4 font-medium">No issue cards were stored for this scan.</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Open the website workspace to run another scan or generate a report from the latest result.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
