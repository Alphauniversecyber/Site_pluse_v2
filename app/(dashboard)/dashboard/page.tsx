import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Clock3,
  Globe2,
  LineChart,
  Radar,
  ShieldAlert,
  Sparkles,
  Zap
} from "lucide-react";

import { ScoreRing } from "@/components/dashboard/score-ring";
import { SnapshotStatCard } from "@/components/dashboard/snapshot-stat-card";
import { EmptyState } from "@/components/dashboard/empty-state";
import { AddWebsiteButton } from "@/components/trial/AddWebsiteButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buildPortfolioImpactSummary } from "@/lib/business-impact";
import { createSupabaseServerClient, requireAuthenticatedUser } from "@/lib/supabase-server";
import { PLAN_LIMITS, cn, formatDateTime, formatRelativeTime, getPlanDisplayName } from "@/lib/utils";
import { resolveWorkspaceContext } from "@/lib/workspace";
import type { ScanResult, ScanSchedule, Website } from "@/types";

function compactUrl(url: string) {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname === "/" ? "" : parsed.pathname.replace(/\/$/, "");
    return `${parsed.hostname.replace(/^www\./, "")}${pathname}`;
  } catch {
    return url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
  }
}

function formatCadence(frequency: ScanSchedule["frequency"] | null | undefined) {
  if (frequency === "daily") {
    return "Daily scans";
  }

  if (frequency === "monthly") {
    return "Monthly scans";
  }

  return "Weekly scans";
}

function getSiteState(score: number | null) {
  if (score === null) {
    return {
      label: "Pending",
      variant: "outline" as const,
      accent: "text-muted-foreground",
      helper: "Awaiting first scan"
    };
  }

  if (score >= 85) {
    return {
      label: "Strong",
      variant: "success" as const,
      accent: "text-emerald-500 dark:text-emerald-400",
      helper: "Healthy monitoring baseline"
    };
  }

  if (score >= 60) {
    return {
      label: "Watch",
      variant: "warning" as const,
      accent: "text-amber-500 dark:text-amber-400",
      helper: "Review on the next pass"
    };
  }

  return {
    label: "At risk",
    variant: "danger" as const,
    accent: "text-rose-500 dark:text-rose-400",
    helper: "Needs immediate attention"
  };
}

function OverviewSignalChip({
  icon: Icon,
  label,
  value,
  note,
  tone = "default"
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  note: string;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const tones = {
    default: {
      shell: "bg-primary/10 text-primary",
      glow: "bg-primary/16"
    },
    success: {
      shell: "bg-emerald-500/12 text-emerald-500 dark:text-emerald-400",
      glow: "bg-emerald-500/16"
    },
    warning: {
      shell: "bg-amber-500/12 text-amber-500 dark:text-amber-400",
      glow: "bg-amber-500/16"
    },
    danger: {
      shell: "bg-rose-500/12 text-rose-500 dark:text-rose-400",
      glow: "bg-rose-500/16"
    }
  } as const;

  const palette = tones[tone];

  return (
    <div className="relative overflow-hidden rounded-[1.4rem] border border-border/80 bg-background/75 p-4 dark:border-white/6 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.86),rgba(15,23,42,0.74))]">
      <div className={cn("pointer-events-none absolute right-0 top-0 h-16 w-16 rounded-full blur-2xl", palette.glow)} />
      <div className="relative flex items-start gap-3">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/6 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
            palette.shell
          )}
        >
          <Icon className="h-[18px] w-[18px]" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            {label}
          </p>
          <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{note}</p>
        </div>
      </div>
    </div>
  );
}

function OverviewHeroMetric({
  label,
  value,
  note,
  accent = "text-primary"
}: {
  label: string;
  value: string;
  note: string;
  accent?: string;
}) {
  return (
    <div className="rounded-[1.35rem] border border-border/75 bg-background/65 px-4 py-4 dark:border-white/6 dark:bg-white/[0.03]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </p>
      <p className={cn("mt-3 font-display text-3xl font-semibold leading-none", accent)}>{value}</p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{note}</p>
    </div>
  );
}

export default async function DashboardOverviewPage() {
  const { profile } = await requireAuthenticatedUser();
  const workspace = await resolveWorkspaceContext(profile);
  const workspaceProfile = workspace.workspaceProfile;
  const supabase = createSupabaseServerClient();
  const { data: websitesData } = await supabase
    .from("websites")
    .select("id,user_id,url,label,is_active,created_at,updated_at")
    .eq("user_id", workspace.workspaceOwnerId)
    .order("created_at", { ascending: false });

  const websites = (websitesData ?? []) as Website[];
  const websiteIds = websites.map((website) => website.id);

  if (!websites.length) {
    return (
      <div className="flex min-h-[calc(100vh-18rem)] items-center justify-center">
        <EmptyState
          icon={Globe2}
          title="Add your first website to get started"
          description="SitePulse monitors your sites, runs weekly audits, and sends branded reports to your clients."
          action={
            workspace.role !== "viewer" ? (
              <AddWebsiteButton profile={workspaceProfile} websiteCount={0}>
                Add a website &rarr;
              </AddWebsiteButton>
            ) : undefined
          }
          className="w-full max-w-2xl"
        />
      </div>
    );
  }

  const [{ data: scansData }, { count: scanCount }, { data: schedulesData }] = await Promise.all([
    websiteIds.length
      ? supabase
          .from("scan_results")
          .select("id,website_id,performance_score,scanned_at")
          .in("website_id", websiteIds)
          .order("scanned_at", { ascending: false })
          .limit(50)
      : Promise.resolve({ data: [] }),
    websiteIds.length
      ? supabase
          .from("scan_results")
          .select("*", { count: "exact", head: true })
          .in("website_id", websiteIds)
          .gte("scanned_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())
      : Promise.resolve({ count: 0 }),
    websiteIds.length
      ? supabase.from("scan_schedules").select("website_id,frequency").in("website_id", websiteIds)
      : Promise.resolve({ data: [] })
  ]);

  const scans = (scansData ?? []) as ScanResult[];
  const schedules = (schedulesData ?? []) as ScanSchedule[];

  const latestByWebsite = new Map<string, ScanResult>();
  for (const scan of scans) {
    if (!latestByWebsite.has(scan.website_id)) {
      latestByWebsite.set(scan.website_id, scan);
    }
  }

  const scheduleByWebsite = new Map<string, ScanSchedule>();
  for (const schedule of schedules) {
    scheduleByWebsite.set(schedule.website_id, schedule);
  }

  const latestScans = Array.from(latestByWebsite.values());
  const averagePerformance = latestScans.length
    ? Math.round(
        latestScans.reduce((sum, scan) => sum + (scan.performance_score ?? 0), 0) / latestScans.length
      )
    : 0;
  const enrichedSites = websites.map((website) => {
    const latestScan = latestByWebsite.get(website.id) ?? null;
    const schedule = scheduleByWebsite.get(website.id) ?? null;
    const score = website.health_score?.overall ?? latestScan?.performance_score ?? null;
    const state = getSiteState(score);

    return {
      website,
      latestScan,
      schedule,
      score,
      state
    };
  });

  const scoredSites = enrichedSites.filter((site) => site.score !== null);
  const averageHealth = scoredSites.length
    ? Math.round(scoredSites.reduce((sum, site) => sum + (site.score ?? 0), 0) / scoredSites.length)
    : averagePerformance;
  const activeSites = websites.filter((website) => website.is_active).length;
  const websiteCapacity = PLAN_LIMITS[workspaceProfile.plan]?.websiteLimit ?? Math.max(websites.length, 1);
  const urgentSites = scoredSites.filter((site) => (site.score ?? 0) < 60).length;
  const watchSites = scoredSites.filter(
    (site) => (site.score ?? 0) >= 60 && (site.score ?? 0) < 85
  ).length;
  const strongSites = scoredSites.filter((site) => (site.score ?? 0) >= 85).length;
  const latestScannedAt = scans[0]?.scanned_at ?? null;
  const focusQueue = [...scoredSites]
    .sort((left, right) => (left.score ?? 999) - (right.score ?? 999))
    .slice(0, 4);
  const portfolioImpact = buildPortfolioImpactSummary({
    urgentSites,
    watchSites,
    totalSites: websites.length,
    averageHealth
  });

  const snapshotStats = [
    {
      label: "Websites monitored",
      value: websites.length,
      support: `${activeSites} active right now`,
      icon: Globe2,
      iconTone: "text-primary",
      iconBg: "bg-primary/10",
      accent: "bg-primary/14"
    },
    {
      label: "Average performance",
      value: averagePerformance,
      support: latestScans.length ? `${latestScans.length} latest site scans` : "Waiting for first scan",
      icon: Radar,
      iconTone: "text-primary",
      iconBg: "bg-primary/10",
      accent: "bg-sky-500/14"
    },
    {
      label: "Scans this month",
      value: scanCount ?? 0,
      support: (scanCount ?? 0) >= 10 ? "Healthy reporting cadence" : "Keep scans flowing",
      icon: LineChart,
      iconTone: "text-primary",
      iconBg: "bg-primary/10",
      accent: "bg-cyan-500/14"
    },
    {
      label: "Sites needing action",
      value: urgentSites,
      support: urgentSites ? "Review the watchlist now" : "No critical sites right now",
      icon: AlertTriangle,
      iconTone: "text-rose-400",
      iconBg: "bg-rose-500/10",
      accent: "bg-rose-500/16"
    }
  ] as const;

  const scheduledReportSites = websites.filter(
    (website) => website.auto_email_reports && (website.report_frequency ?? "weekly") !== "never"
  ).length;
  const reportingMode =
    scheduledReportSites > 0
      ? `${scheduledReportSites} site${scheduledReportSites === 1 ? "" : "s"} sending scheduled reports`
      : "Manual report sending";

  return (
    <div className="space-y-8 xl:space-y-10">
      <div className="grid items-start gap-6 min-[1480px]:grid-cols-[minmax(0,1.12fr)_minmax(320px,0.88fr)] min-[1800px]:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
        <Card className="overflow-hidden border-border/80 dark:border-white/7 dark:bg-[linear-gradient(180deg,rgba(30,41,59,0.96),rgba(15,23,42,0.92))] dark:shadow-[0_28px_80px_-46px_rgba(15,23,42,0.9),0_0_0_1px_rgba(96,165,250,0.05)]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.14),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.08),transparent_26%)]" />
          <CardContent className="relative p-6 sm:p-7 xl:p-8">
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary">
                    Overview
                  </p>
                  <h1 className="mt-3 break-words font-display text-3xl font-semibold sm:text-4xl xl:text-[2.65rem] xl:leading-[1.05]">
                    {`Welcome back, ${profile.full_name?.split(" ")[0] ?? "there"}`}
                  </h1>
                  <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                    Track every client website, catch score drops before they spread, and keep your agency&apos;s proof-of-value workflow moving without manual follow-ups.
                  </p>
                </div>

                <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row min-[1480px]:flex-col min-[1680px]:flex-row">
                  <Button asChild variant="outline" className="min-w-[9.75rem]">
                    <Link href="/dashboard/reports">Open reports</Link>
                  </Button>
                  {workspace.role !== "viewer" ? (
                    <AddWebsiteButton
                      profile={workspaceProfile}
                      websiteCount={websites.length}
                      style={{ minWidth: "9.75rem" }}
                    >
                      Add website
                    </AddWebsiteButton>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Badge variant={workspaceProfile.plan === "agency" ? "success" : workspaceProfile.plan === "starter" ? "default" : "outline"}>
                  {getPlanDisplayName(workspaceProfile.plan)} plan
                </Badge>
                <Badge variant={urgentSites ? "warning" : "success"}>
                  {urgentSites ? `${urgentSites} sites need review` : "No urgent client sites"}
                </Badge>
                <Badge variant="outline">
                  {latestScannedAt ? `Last scan ${formatRelativeTime(latestScannedAt)}` : "No scans yet"}
                </Badge>
              </div>

              <div className="rounded-[1.5rem] border border-primary/15 bg-primary/[0.08] px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                  Business impact layer
                </p>
                <p className="mt-2 text-sm leading-7 text-foreground/90">{portfolioImpact}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <OverviewHeroMetric
                  label="Agency health"
                  value={`${averageHealth}`}
                  note={urgentSites ? "Overall baseline is under pressure." : "Monitoring baseline is holding steady."}
                  accent={urgentSites ? "text-amber-500 dark:text-amber-400" : "text-primary"}
                />
                <OverviewHeroMetric
                  label="Review queue"
                  value={`${urgentSites}`}
                  note={urgentSites ? "Sites need attention before the next report run." : "No urgent client sites right now."}
                  accent={urgentSites ? "text-rose-500 dark:text-rose-400" : "text-emerald-500 dark:text-emerald-400"}
                />
                <OverviewHeroMetric
                  label="Scans this month"
                  value={`${scanCount ?? 0}`}
                  note={reportingMode}
                  accent="text-sky-500 dark:text-sky-400"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-border/80 dark:border-white/7 dark:bg-[linear-gradient(180deg,rgba(30,41,59,0.96),rgba(15,23,42,0.92))] dark:shadow-[0_28px_80px_-46px_rgba(15,23,42,0.9),0_0_0_1px_rgba(96,165,250,0.05)]">
          <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-primary/0 via-primary/55 to-primary/0" />
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-primary">
                  Agency rhythm
                </p>
                <CardTitle className="mt-2 text-2xl">Monitoring cadence stays live</CardTitle>
              </div>
              <Badge variant={workspaceProfile.plan === "agency" ? "success" : workspaceProfile.plan === "starter" ? "default" : "outline"}>
                {getPlanDisplayName(workspaceProfile.plan)}
              </Badge>
            </div>
            <CardDescription>
              See what changed most recently, how many client sites are active, and whether reporting is flowing automatically.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1 min-[1800px]:grid-cols-3">
            <OverviewSignalChip
              icon={Clock3}
              label="Latest scan"
              value={latestScannedAt ? formatRelativeTime(latestScannedAt) : "No scans yet"}
              note={latestScannedAt ? formatDateTime(latestScannedAt) : "Run the first scan to start trend tracking."}
            />
            <OverviewSignalChip
              icon={Activity}
              label="Coverage"
              value={`${activeSites}/${websiteCapacity} sites active`}
              note={
                activeSites === websites.length
                  ? websites.length < websiteCapacity
                    ? `${websiteCapacity - websites.length} of your ${getPlanDisplayName(workspaceProfile.plan)} slots are still open.`
                    : "All plan slots are currently in use."
                  : "Some sites are paused or still onboarding."
              }
              tone={activeSites === websites.length ? "success" : "warning"}
            />
            <OverviewSignalChip
              icon={Sparkles}
              label="Reporting"
              value={reportingMode}
              note={
                scheduledReportSites > 0
                  ? "Scheduled delivery is active for at least one monitored website."
                  : "Enable scheduled reports from each website when you're ready."
              }
              tone={scheduledReportSites > 0 ? "success" : "default"}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid items-start gap-6 min-[1480px]:grid-cols-[minmax(0,1.08fr)_minmax(380px,0.92fr)] min-[1800px]:grid-cols-[minmax(0,1.12fr)_minmax(430px,0.88fr)]">
        <Card className="overflow-hidden border-border/80 dark:border-white/7 dark:bg-[linear-gradient(180deg,rgba(30,41,59,0.96),rgba(15,23,42,0.92))] dark:shadow-[0_28px_80px_-46px_rgba(15,23,42,0.9),0_0_0_1px_rgba(96,165,250,0.05)]">
          <CardHeader className="pb-5">
            <CardTitle>Agency health snapshot</CardTitle>
            <CardDescription>
              Four fast signals that tell you whether coverage, scan volume, and client performance are holding steady.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid auto-rows-fr gap-4 md:grid-cols-2">
            {snapshotStats.map((stat) => (
              <SnapshotStatCard
                key={stat.label}
                label={stat.label}
                value={stat.value}
                support={stat.support}
                icon={stat.icon}
                iconTone={stat.iconTone}
                iconBg={stat.iconBg}
                accent={stat.accent}
              />
            ))}
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-border/80 dark:border-white/7 dark:bg-[linear-gradient(180deg,rgba(30,41,59,0.96),rgba(15,23,42,0.92))] dark:shadow-[0_28px_80px_-46px_rgba(15,23,42,0.9),0_0_0_1px_rgba(96,165,250,0.05)]">
          <CardHeader className="pb-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <CardTitle>Current score pulse</CardTitle>
                <CardDescription className="mt-2">
                  Keep an eye on the agency-wide baseline and the client sites that need attention before the next report goes out.
                </CardDescription>
              </div>
              <Badge
                variant={urgentSites ? "warning" : "success"}
                className="shrink-0 whitespace-nowrap"
              >
                {urgentSites ? `${urgentSites} urgent` : "Stable"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 min-[1700px]:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
            <div className="space-y-4">
              <div className="rounded-[1.7rem] border border-border/75 bg-background/75 p-5 dark:border-white/6 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.82),rgba(15,23,42,0.72))]">
                <ScoreRing
                  label="Agency health"
                  score={averageHealth}
                  statusLabel={urgentSites ? "Watchlist active" : "Stable baseline"}
                  className="border-0 bg-transparent p-0 shadow-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Strong", value: strongSites, accent: "text-emerald-500 dark:text-emerald-400" },
                  { label: "Watch", value: watchSites, accent: "text-amber-500 dark:text-amber-400" },
                  { label: "Urgent", value: urgentSites, accent: "text-rose-500 dark:text-rose-400" }
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-border/70 bg-card/70 px-3 py-3 text-center dark:border-white/6 dark:bg-white/[0.03]"
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      {item.label}
                    </p>
                    <p className={cn("mt-2 font-display text-2xl font-semibold leading-none", item.accent)}>
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[1.7rem] border border-border/75 bg-background/75 p-5 dark:border-white/6 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.82),rgba(15,23,42,0.72))]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">
                    Needs review now
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {urgentSites
                      ? `${urgentSites} client site(s) are below the healthy range. Start with the lowest score first.`
                      : "No client sites are in the urgent range right now. Keep the watch list moving."}
                  </p>
                </div>
                <div className="hidden h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary sm:flex">
                  <ShieldAlert className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {focusQueue.length ? (
                  focusQueue.map((site) => (
                    <Link
                      key={site.website.id}
                      href={`/dashboard/websites/${site.website.id}`}
                      className="group flex items-center gap-4 rounded-2xl border border-border/70 bg-card/70 p-4 transition duration-200 hover:border-primary/30 hover:bg-card dark:border-white/6 dark:bg-white/[0.03]"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-medium">{site.website.label}</p>
                          <Badge variant={site.state.variant}>{site.state.label}</Badge>
                        </div>
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {compactUrl(site.website.url)}
                        </p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {site.latestScan?.scanned_at
                            ? `Last scan ${formatRelativeTime(site.latestScan.scanned_at)}`
                            : "No completed scan yet"}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className={cn("font-display text-3xl font-semibold leading-none", site.state.accent)}>
                          {site.score ?? "--"}
                        </p>
                        <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          latest score
                        </p>
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-border bg-card/50 px-4 py-8 text-center text-sm text-muted-foreground">
                    Add a website and run the first scan to start the attention queue.
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden border-border/80 dark:border-white/7 dark:bg-[linear-gradient(180deg,rgba(30,41,59,0.96),rgba(15,23,42,0.92))] dark:shadow-[0_28px_80px_-46px_rgba(15,23,42,0.9),0_0_0_1px_rgba(96,165,250,0.05)]">
        <CardHeader className="pb-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Client monitoring board</CardTitle>
              <CardDescription className="mt-2">
                The latest client sites in one clean roster, with scan cadence, current risk level, and the fastest path to details.
              </CardDescription>
            </div>
            <Button asChild variant="outline" className="sm:self-start">
              <Link href="/dashboard/websites">
                Open all websites <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {websites.length ? (
            <div className="overflow-hidden rounded-[1.8rem] border border-border/75 bg-background/70 dark:border-white/6 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.82),rgba(15,23,42,0.72))]">
              <div className="hidden grid-cols-[minmax(0,1.55fr)_minmax(160px,0.52fr)_minmax(140px,0.44fr)_minmax(170px,0.5fr)_auto] gap-4 border-b border-border/70 px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground md:grid">
                <div>Client site</div>
                <div>Cadence</div>
                <div>Status</div>
                <div>Latest score</div>
                <div className="text-right">Action</div>
              </div>

              <div className="divide-y divide-border/70">
                {enrichedSites.slice(0, 6).map((site) => (
                  <div
                    key={site.website.id}
                    className="grid gap-4 px-4 py-5 transition duration-200 hover:bg-white/[0.02] md:grid-cols-[minmax(0,1.55fr)_minmax(160px,0.52fr)_minmax(140px,0.44fr)_minmax(170px,0.5fr)_auto] md:items-center md:px-6"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium">{site.website.label}</p>
                        <Badge variant={site.website.is_active ? "success" : "outline"}>
                          {site.website.is_active ? "Live" : "Paused"}
                        </Badge>
                      </div>
                      <p className="mt-1 truncate text-sm text-muted-foreground">{site.website.url}</p>
                    </div>

                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground md:hidden">
                        Cadence
                      </p>
                      <p className="text-sm font-medium">
                        {site.schedule ? formatCadence(site.schedule.frequency) : "Schedule pending"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {site.schedule?.next_scan_at
                          ? `Next ${formatRelativeTime(site.schedule.next_scan_at)}`
                          : "Awaiting next scan time"}
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground md:hidden">
                        Status
                      </p>
                      <Badge variant={site.state.variant}>{site.state.label}</Badge>
                      <p className="mt-2 text-xs text-muted-foreground">{site.state.helper}</p>
                    </div>

                    <div className="md:text-right">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground md:hidden">
                        Latest score
                      </p>
                      {site.score !== null ? (
                        <>
                          <p className={cn("font-display text-3xl font-semibold leading-none", site.state.accent)}>
                            {site.score}
                          </p>
                          <p className="mt-2 text-xs text-muted-foreground">
                            {site.latestScan?.scanned_at
                              ? formatRelativeTime(site.latestScan.scanned_at)
                              : "No recent scan"}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="font-display text-2xl font-semibold leading-none text-muted-foreground">
                            --
                          </p>
                          <p className="mt-2 text-xs text-muted-foreground">No scan history yet</p>
                        </>
                      )}
                    </div>

                    <div className="flex items-center justify-start md:justify-end">
                      <Button asChild variant="outline" className="min-w-[10.5rem] justify-between rounded-2xl">
                        <Link href={`/dashboard/websites/${site.website.id}`}>
                          View details <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-[1.8rem] border border-dashed border-border bg-background/75 p-10 text-center dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.82),rgba(15,23,42,0.72))]">
              <div className="mx-auto flex max-w-md flex-col items-center text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-primary/10 text-primary">
                  <Zap className="h-6 w-6" />
                </div>
                <p className="mt-5 font-display text-2xl font-semibold">Start your first monitoring board</p>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  Add a client website to begin scans, build performance history, and generate agency-ready reporting.
                </p>
                {workspace.role !== "viewer" ? (
                  <AddWebsiteButton
                    profile={workspaceProfile}
                    websiteCount={websites.length}
                    style={{ marginTop: "24px" }}
                  >
                    Add website
                  </AddWebsiteButton>
                ) : null}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
