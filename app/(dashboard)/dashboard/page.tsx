import Link from "next/link";
import { AlertTriangle, ArrowRight, Globe2, LineChart, Radar } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { ScoreRing } from "@/components/dashboard/score-ring";
import { SnapshotStatCard } from "@/components/dashboard/snapshot-stat-card";
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
  const snapshotStats = [
    {
      label: "Websites monitored",
      value: websites?.length ?? 0,
      icon: Globe2,
      iconTone: "text-primary",
      iconBg: "bg-primary/10"
    },
    {
      label: "Average performance",
      value: averagePerformance,
      icon: Radar,
      iconTone: "text-primary",
      iconBg: "bg-primary/10"
    },
    {
      label: "Scans this month",
      value: scanCount ?? 0,
      icon: LineChart,
      iconTone: "text-primary",
      iconBg: "bg-primary/10"
    },
    {
      label: "Critical sites",
      value: criticalSites,
      icon: AlertTriangle,
      iconTone: "text-rose-400",
      iconBg: "bg-rose-500/10"
    }
  ] as const;

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

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)] min-[1800px]:grid-cols-[minmax(0,1.14fr)_minmax(420px,0.86fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Agency health snapshot</CardTitle>
          </CardHeader>
          <CardContent className="grid auto-rows-fr gap-4 md:grid-cols-2 min-[1800px]:grid-cols-4">
            {snapshotStats.map((stat) => {
              return (
                <SnapshotStatCard
                  key={stat.label}
                  label={stat.label}
                  value={stat.value}
                  icon={stat.icon}
                  iconTone={stat.iconTone}
                  iconBg={stat.iconBg}
                />
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Current score pulse</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <ScoreRing label="Performance" score={averagePerformance} className="justify-center" />
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
                    <div key={scan.id} className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{website?.label ?? "Unknown website"}</p>
                        <p className="truncate text-xs text-muted-foreground">{website?.url}</p>
                      </div>
                      <span className="shrink-0 font-display text-2xl font-semibold leading-none">
                        {scan.performance_score}
                      </span>
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
