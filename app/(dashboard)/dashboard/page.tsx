import Link from "next/link";
import { AlertTriangle, ArrowRight, Globe2, LineChart, Radar } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { ScoreRing } from "@/components/dashboard/score-ring";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createSupabaseServerClient, requireAuthenticatedUser } from "@/lib/supabase-server";

export default async function DashboardOverviewPage() {
  const { profile } = await requireAuthenticatedUser();
  const supabase = createSupabaseServerClient();

  const [{ data: websites }, { data: scans }, { count: scanCount }] = await Promise.all([
    supabase.from("websites").select("*").order("created_at", { ascending: false }),
    supabase.from("scan_results").select("*").order("scanned_at", { ascending: false }).limit(50),
    supabase
      .from("scan_results")
      .select("*", { count: "exact", head: true })
      .gte("scanned_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())
  ]);

  const latestByWebsite = new Map<string, any>();
  for (const scan of scans ?? []) {
    if (!latestByWebsite.has(scan.website_id)) {
      latestByWebsite.set(scan.website_id, scan);
    }
  }

  const latestScans = Array.from(latestByWebsite.values());
  const averagePerformance = latestScans.length
    ? Math.round(
        latestScans.reduce((sum, scan) => sum + (scan.performance_score ?? 0), 0) / latestScans.length
      )
    : 0;
  const criticalSites = latestScans.filter((scan) => scan.performance_score < 50).length;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Overview"
        title={`Welcome back, ${profile.full_name?.split(" ")[0] ?? "there"}`}
        description="Track every client website, catch score drops early, and keep agency reports moving without manual work."
        actions={
          <Button asChild>
            <Link href="/dashboard/websites/add">Add website</Link>
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Agency health snapshot</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-4">
            <div className="rounded-3xl border border-border bg-background p-5">
              <div className="flex items-center gap-3 text-primary">
                <Globe2 className="h-5 w-5" />
                <span className="text-sm text-muted-foreground">Websites monitored</span>
              </div>
              <p className="mt-4 font-display text-4xl font-semibold">{websites?.length ?? 0}</p>
            </div>
            <div className="rounded-3xl border border-border bg-background p-5">
              <div className="flex items-center gap-3 text-primary">
                <Radar className="h-5 w-5" />
                <span className="text-sm text-muted-foreground">Average performance</span>
              </div>
              <p className="mt-4 font-display text-4xl font-semibold">{averagePerformance}</p>
            </div>
            <div className="rounded-3xl border border-border bg-background p-5">
              <div className="flex items-center gap-3 text-primary">
                <LineChart className="h-5 w-5" />
                <span className="text-sm text-muted-foreground">Scans this month</span>
              </div>
              <p className="mt-4 font-display text-4xl font-semibold">{scanCount ?? 0}</p>
            </div>
            <div className="rounded-3xl border border-border bg-background p-5">
              <div className="flex items-center gap-3 text-rose-400">
                <AlertTriangle className="h-5 w-5" />
                <span className="text-sm text-muted-foreground">Critical sites</span>
              </div>
              <p className="mt-4 font-display text-4xl font-semibold">{criticalSites}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Current score pulse</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <ScoreRing label="Performance" score={averagePerformance} />
            <div className="rounded-3xl border border-border bg-background p-6">
              <p className="text-sm text-muted-foreground">
                {criticalSites
                  ? `${criticalSites} client site(s) need immediate attention.`
                  : "No sites are currently in the critical zone."}
              </p>
              <div className="mt-6 space-y-3">
                {latestScans.slice(0, 4).map((scan) => {
                  const website = websites?.find((item) => item.id === scan.website_id);
                  return (
                    <div key={scan.id} className="flex items-center justify-between rounded-2xl border border-border bg-card p-3">
                      <div>
                        <p className="font-medium">{website?.label ?? "Unknown website"}</p>
                        <p className="text-xs text-muted-foreground">{website?.url}</p>
                      </div>
                      <span className="font-display text-2xl font-semibold">{scan.performance_score}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent client sites</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(websites ?? []).length ? (
            (websites ?? []).slice(0, 6).map((website) => {
              const latestScan = latestByWebsite.get(website.id);
              return (
                <div key={website.id} className="flex flex-col gap-4 rounded-3xl border border-border bg-background p-5 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-medium">{website.label}</p>
                    <p className="text-sm text-muted-foreground">{website.url}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Latest score</p>
                      {latestScan ? (
                        <p className="font-display text-3xl font-semibold">{latestScan.performance_score}</p>
                      ) : (
                        <p className="text-sm text-muted-foreground">Not scanned yet</p>
                      )}
                    </div>
                    <Button asChild variant="outline">
                      <Link href={`/dashboard/websites/${website.id}`}>
                        View details <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-3xl border border-dashed border-border bg-background p-10 text-center text-muted-foreground">
              Add your first client website to start weekly monitoring and white-label reporting.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
