"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  Activity,
  AlertTriangle,
  Clock3,
  FileDown,
  Mail,
  Plus,
  Shield,
  ShieldCheck,
  TrendingUp,
  WandSparkles,
  X,
  type LucideIcon
} from "lucide-react";
import { toast } from "sonner";

import { DeviceScoreChart } from "@/components/charts/device-score-chart";
import { ScoreTrendChart } from "@/components/charts/score-trend-chart";
import { EmptyState } from "@/components/dashboard/empty-state";
import { LinkHealthPanel } from "@/components/dashboard/link-health-panel";
import { MetricTile } from "@/components/dashboard/metric-tile";
import { PageHeader } from "@/components/dashboard/page-header";
import { ScoreRing } from "@/components/dashboard/score-ring";
import { TrialPaywall } from "@/components/trial/TrialPaywall";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useTrialPaywall } from "@/hooks/useTrialPaywall";
import { useUser } from "@/hooks/useUser";
import type {
  BrokenLinkRecord,
  CompetitorScanRecord,
  CruxDataRecord,
  PlainLanguageDifficulty,
  ScanResult,
  SecurityHeadersRecord,
  Severity,
  SeoAuditRecord,
  Website,
  WebsiteScanPlainEnglish
} from "@/types";
import { fetchJson } from "@/lib/api-client";
import { buildSiteBusinessImpact } from "@/lib/business-impact";
import { buildUptimeSummary } from "@/lib/health-score";
import { getFriendlyScanFailureMessage } from "@/lib/scan-errors";
import { cn } from "@/lib/utils";

type WebsiteDetailResponse = Website & {
  scans: ScanResult[];
};

function latestCompetitorEntries(scans: CompetitorScanRecord[] = []) {
  const map = new Map<string, CompetitorScanRecord>();

  for (const scan of scans) {
    if (scan.scan_status !== "success") {
      continue;
    }

    if (!map.has(scan.competitor_url)) {
      map.set(scan.competitor_url, scan);
    }
  }

  return Array.from(map.values()).slice(0, 3);
}

function gradeVariant(grade: string) {
  if (grade === "A" || grade === "green") return "success" as const;
  if (grade === "B" || grade === "orange") return "warning" as const;
  return "danger" as const;
}

function statusFromBoolean(value: boolean) {
  return value ? "Pass" : "Fail";
}

function seoStatusPass(status: string | null | undefined) {
  return (status ?? "").trim().toLowerCase() === "good";
}

function cleanRawText(text: string, maxLength = 150) {
  const cleaned = text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/https?:\/\/[^\s)]+/g, "")
    .replace(/[`*_#>~]/g, " ")
    .replace(/\b(LCP|FID|CLS|TBT|TTFB|INP|DOM|API|CDN|HTTP|CSS|JS|viewport)\b|render-blocking/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  const shortened = cleaned.slice(0, Math.max(0, maxLength - 3));
  const boundary = shortened.search(/\s+\S*$/);
  const safe = boundary > 24 ? shortened.slice(0, boundary) : shortened;

  return `${safe.trim()}...`;
}

function normalizeTitleKey(value: string) {
  return cleanRawText(value.toLowerCase(), 120).replace(/[^a-z0-9]+/g, " ").trim();
}

function severityRank(severity: Severity) {
  return severity === "high" ? 3 : severity === "medium" ? 2 : 1;
}

function compactDisplayUrl(value: string, maxLength = 56) {
  try {
    const parsed = new URL(value);
    const compact = `${parsed.hostname}${parsed.pathname === "/" ? "" : parsed.pathname}`;
    return compact.length <= maxLength ? compact : `${compact.slice(0, maxLength - 3)}...`;
  } catch {
    return value.length <= maxLength ? value : `${value.slice(0, maxLength - 3)}...`;
  }
}

function normalizeRecipientEmails(values: string[] | string) {
  const source = Array.isArray(values) ? values : values.split(/[\n,]+/);
  const deduped = new Set<string>();

  for (const item of source) {
    const normalized = item.trim().toLowerCase();
    if (!normalized) {
      continue;
    }
    deduped.add(normalized);
  }

  return Array.from(deduped);
}

function isValidRecipientEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function normalizeSeoAuditRecord(seoAudit: Website["seo_audit"] | null): SeoAuditRecord | null {
  if (!seoAudit) {
    return null;
  }

  return {
    ...seoAudit,
    title_tag: {
      exists: Boolean(seoAudit.title_tag?.exists),
      length: seoAudit.title_tag?.length ?? 0,
      status: seoAudit.title_tag?.status ?? (seoAudit.title_tag?.exists ? "Detected" : "Missing"),
      value: seoAudit.title_tag?.value ?? null
    },
    meta_description: {
      exists: Boolean(seoAudit.meta_description?.exists),
      length: seoAudit.meta_description?.length ?? 0,
      status:
        seoAudit.meta_description?.status ??
        (seoAudit.meta_description?.exists ? "Detected" : "Missing"),
      value: seoAudit.meta_description?.value ?? null
    },
    headings: {
      h1_count: seoAudit.headings?.h1_count ?? 0,
      h2_count: seoAudit.headings?.h2_count ?? 0,
      h3_count: seoAudit.headings?.h3_count ?? 0,
      status: seoAudit.headings?.status ?? "Missing",
      outline: Array.isArray(seoAudit.headings?.outline) ? seoAudit.headings.outline : []
    },
    images_missing_alt: seoAudit.images_missing_alt ?? 0,
    images_missing_alt_urls: Array.isArray(seoAudit.images_missing_alt_urls)
      ? seoAudit.images_missing_alt_urls
      : [],
    og_tags: {
      title: Boolean(seoAudit.og_tags?.title),
      description: Boolean(seoAudit.og_tags?.description),
      image: Boolean(seoAudit.og_tags?.image),
      card: Boolean(seoAudit.og_tags?.card)
    },
    twitter_tags: {
      title: Boolean(seoAudit.twitter_tags?.title),
      description: Boolean(seoAudit.twitter_tags?.description),
      image: Boolean(seoAudit.twitter_tags?.image),
      card: Boolean(seoAudit.twitter_tags?.card)
    },
    canonical: {
      exists: Boolean(seoAudit.canonical?.exists),
      href: seoAudit.canonical?.href ?? null,
      self_referencing: Boolean(seoAudit.canonical?.self_referencing),
      status: seoAudit.canonical?.status ?? "Missing"
    },
    schema_present: Boolean(seoAudit.schema_present),
    schema_types: Array.isArray(seoAudit.schema_types) ? seoAudit.schema_types : [],
    fix_suggestions: Array.isArray(seoAudit.fix_suggestions) ? seoAudit.fix_suggestions : []
  };
}

function normalizeBrokenLinksRecord(brokenLinks: Website["broken_links"] | null): BrokenLinkRecord | null {
  if (!brokenLinks) {
    return null;
  }

  return {
    ...brokenLinks,
    total_links: brokenLinks.total_links ?? 0,
    working_links: brokenLinks.working_links ?? 0,
    broken_links: brokenLinks.broken_links ?? 0,
    redirect_chains: brokenLinks.redirect_chains ?? 0,
    broken_urls: Array.isArray(brokenLinks.broken_urls) ? brokenLinks.broken_urls : [],
    redirect_urls: Array.isArray(brokenLinks.redirect_urls) ? brokenLinks.redirect_urls : []
  };
}

function getCoreVitalStatus(metric: "lcp" | "fid" | "cls" | "tbt", value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return {
      label: "Unknown",
      variant: "outline" as const
    };
  }

  if (metric === "lcp") {
    if (value <= 2500) return { label: "Good", variant: "success" as const };
    if (value <= 4000) return { label: "Watch", variant: "warning" as const };
    return { label: "Slow", variant: "danger" as const };
  }

  if (metric === "fid") {
    if (value <= 100) return { label: "Good", variant: "success" as const };
    if (value <= 300) return { label: "Watch", variant: "warning" as const };
    return { label: "Slow", variant: "danger" as const };
  }

  if (metric === "cls") {
    if (value <= 0.1) return { label: "Good", variant: "success" as const };
    if (value <= 0.25) return { label: "Watch", variant: "warning" as const };
    return { label: "Unstable", variant: "danger" as const };
  }

  if (value <= 200) return { label: "Good", variant: "success" as const };
  if (value <= 600) return { label: "Watch", variant: "warning" as const };
  return { label: "Slow", variant: "danger" as const };
}

function DetailSignalCard({
  icon: Icon,
  accent,
  eyebrow,
  value,
  description,
  footnote,
  badge,
  valueClassName,
  className
}: {
  icon: LucideIcon;
  accent: "blue" | "emerald" | "amber" | "rose";
  eyebrow: string;
  value: ReactNode;
  description: string;
  footnote?: ReactNode;
  badge?: ReactNode;
  valueClassName?: string;
  className?: string;
}) {
  const accents = {
    blue: {
      glow: "bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.2),transparent_72%)]",
      iconShell: "bg-sky-500/10 text-sky-700 dark:bg-sky-500/12 dark:text-sky-300"
    },
    emerald: {
      glow: "bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.18),transparent_72%)]",
      iconShell: "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/12 dark:text-emerald-300"
    },
    amber: {
      glow: "bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.18),transparent_72%)]",
      iconShell: "bg-amber-500/10 text-amber-700 dark:bg-amber-500/12 dark:text-amber-300"
    },
    rose: {
      glow: "bg-[radial-gradient(circle_at_top_right,rgba(244,63,94,0.18),transparent_72%)]",
      iconShell: "bg-rose-500/10 text-rose-700 dark:bg-rose-500/12 dark:text-rose-300"
    }
  }[accent];

  return (
    <Card
      className={cn(
        "detail-monitor-card relative overflow-hidden",
        className
      )}
    >
      <div className="detail-monitor-inset pointer-events-none absolute inset-px rounded-[1.45rem]" />
      <div className={cn("pointer-events-none absolute right-0 top-0 h-24 w-28 blur-2xl", accents.glow)} />
      <CardContent className="relative flex h-full min-h-[12.5rem] flex-col gap-5 p-5">
        <div className="flex items-start justify-between gap-4">
          <div
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200/85 shadow-sm dark:border-white/8",
              accents.iconShell
            )}
          >
            <Icon className="h-5 w-5" strokeWidth={1.9} />
          </div>
          {badge}
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{eyebrow}</p>
          <div className={cn("font-display text-4xl font-semibold leading-none tracking-tight", valueClassName)}>{value}</div>
          <p className="max-w-[22rem] text-sm leading-6 text-muted-foreground">{description}</p>
        </div>

        {footnote ? <p className="mt-auto text-xs leading-5 text-muted-foreground/90">{footnote}</p> : null}
      </CardContent>
    </Card>
  );
}

function difficultyStars(difficulty: PlainLanguageDifficulty) {
  return difficulty === "Easy" ? "⭐" : difficulty === "Medium" ? "⭐⭐" : "⭐⭐⭐";
}

function buildFallbackSummary(counts: { high: number; medium: number; low: number }) {
  if (counts.high > 0) {
    return `Fix the ${counts.high} high priority issue${counts.high === 1 ? "" : "s"} first to see the biggest improvement.`;
  }

  if (counts.medium > 0) {
    return `Start with the ${counts.medium} medium priority fix${counts.medium === 1 ? "" : "es"} to improve the site steadily.`;
  }

  if (counts.low > 0) {
    return "Your website looks healthy overall. The remaining low priority items are mostly polish.";
  }

  return "This scan looks healthy overall, with no major issues needing urgent attention.";
}

function buildLocalPlainLanguage(scan: ScanResult): WebsiteScanPlainEnglish {
  const issueMap = new Map<
    string,
    {
      id: string;
      title: string;
      description: string;
      severity: Severity;
      device: "mobile" | "desktop" | "both" | null;
    }
  >();

  for (const issue of scan.issues ?? []) {
    const key = normalizeTitleKey(issue.title);
    const existing = issueMap.get(key);

    if (!existing) {
      issueMap.set(key, {
        id: issue.id,
        title: cleanRawText(issue.title, 70) || "Needs attention",
        description: cleanRawText(issue.description, 150),
        severity: issue.severity,
        device: issue.device ?? null
      });
      continue;
    }

    issueMap.set(key, {
      id: existing.id,
      title: existing.title,
      description:
        existing.description.length >= issue.description.length
          ? existing.description
          : cleanRawText(issue.description, 150),
      severity: severityRank(issue.severity) > severityRank(existing.severity) ? issue.severity : existing.severity,
      device:
        existing.device && issue.device && existing.device !== issue.device
          ? "both"
          : existing.device ?? issue.device ?? null
    });
  }

  const recommendationMap = new Map<
    string,
    {
      id: string;
      title: string;
      description: string;
      priority: Severity;
      device: "mobile" | "desktop" | "both" | null;
    }
  >();

  for (const recommendation of scan.recommendations ?? []) {
    const key = normalizeTitleKey(recommendation.title);
    const existing = recommendationMap.get(key);

    if (!existing) {
      recommendationMap.set(key, {
        id: recommendation.id,
        title: cleanRawText(recommendation.title, 70) || "Quick win",
        description: cleanRawText(recommendation.description, 150),
        priority: recommendation.priority,
        device: recommendation.device ?? null
      });
      continue;
    }

    recommendationMap.set(key, {
      id: existing.id,
      title: existing.title,
      description:
        existing.description.length >= recommendation.description.length
          ? existing.description
          : cleanRawText(recommendation.description, 150),
      priority:
        severityRank(recommendation.priority) > severityRank(existing.priority)
          ? recommendation.priority
          : existing.priority,
      device:
        existing.device && recommendation.device && existing.device !== recommendation.device
          ? "both"
          : existing.device ?? recommendation.device ?? null
    });
  }

  const rawIssues = Array.from(issueMap.values())
    .sort((left, right) => severityRank(right.severity) - severityRank(left.severity))
    .slice(0, 8);
  const rawRecommendations = Array.from(recommendationMap.values())
    .sort((left, right) => severityRank(right.priority) - severityRank(left.priority))
    .slice(0, 5);

  const issues = rawIssues.map((issue) => ({
    id: issue.id,
    title: issue.title,
    whats_happening: cleanRawText(issue.description, 100) || "Part of your website needs attention.",
    business_impact:
      issue.severity === "high"
        ? "Visitors may leave before taking action."
        : "This can make the site feel less polished or effective.",
    how_to_fix:
      issue.device === "both"
        ? "Ask your developer to fix this for both mobile and desktop."
        : "Ask your developer to review and fix this area.",
    severity: issue.severity,
    difficulty: issue.severity === "high" ? "Medium" : "Easy",
    time_estimate: issue.severity === "high" ? "1-2 days" : "1-2 hours",
    category:
      /seo|meta|search|robots|sitemap/i.test(`${issue.title} ${issue.description}`)
        ? "SEO"
        : /access|aria|alt|label|keyboard|contrast/i.test(`${issue.title} ${issue.description}`)
          ? "Accessibility"
          : /security|https|cookie|privacy|best practice/i.test(`${issue.title} ${issue.description}`)
            ? "Security"
            : "Performance"
  })) satisfies WebsiteScanPlainEnglish["issues"];

  const recommendations = rawRecommendations.map((recommendation) => ({
    title: recommendation.title,
    description:
      cleanRawText(recommendation.description, 100) ||
      "This will improve speed, visibility, or user experience.",
    difficulty: recommendation.priority === "high" ? "Medium" : "Easy",
    time_estimate: recommendation.priority === "high" ? "1-2 days" : "1-2 hours",
    priority: recommendation.priority
  })) satisfies WebsiteScanPlainEnglish["recommendations"];

  const severityCounts = {
    high: issues.filter((issue) => issue.severity === "high").length,
    medium: issues.filter((issue) => issue.severity === "medium").length,
    low: issues.filter((issue) => issue.severity === "low").length
  };

  return {
    provider: "template",
    summary: buildFallbackSummary(severityCounts),
    severity_counts: severityCounts,
    issues,
    recommendations,
    raw_issues: rawIssues,
    raw_recommendations: rawRecommendations
  };
}

function badgeVariantForSeverity(severity: Severity) {
  return severity === "high" ? "danger" : severity === "medium" ? "warning" : "success";
}

function WebsiteHealthSignalsCard(input: {
  websiteUrl: string;
  seoAudit: Website["seo_audit"] | null;
  brokenLinks: Website["broken_links"] | null;
  sslCheck: Website["ssl_check"] | null;
  securityHeaders: SecurityHeadersRecord | null;
  cruxData: CruxDataRecord | null;
  uptimeSummary: ReturnType<typeof buildUptimeSummary>;
  competitorEntries: CompetitorScanRecord[];
  competitorInput: string;
  onCompetitorInputChange: (value: string) => void;
  onSaveCompetitors: () => void;
  isPending: boolean;
  healthScore: Website["health_score"] | null;
  healthSignalsSyncing: boolean;
  hasCurrentScan: boolean;
}) {
  const {
    websiteUrl,
    seoAudit,
    brokenLinks,
    sslCheck,
    securityHeaders,
    cruxData,
    uptimeSummary,
    competitorEntries,
    competitorInput,
    onCompetitorInputChange,
    onSaveCompetitors,
    isPending,
    healthScore,
    healthSignalsSyncing,
    hasCurrentScan
  } = input;

  return (
    <Card className="detail-monitor-card relative overflow-hidden">
      <div className="detail-monitor-inset pointer-events-none absolute inset-px rounded-[1.45rem]" />
      <div className="pointer-events-none absolute right-8 top-0 h-28 w-44 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.16),transparent_72%)] blur-3xl" />
      <CardHeader className="relative gap-4 pb-3 sm:pb-6">
        <div className="space-y-2">
          <CardTitle>Website health signals</CardTitle>
          <p className="text-sm text-muted-foreground">
            On-page SEO, link health, security, uptime, real user data, and competitor tracking in one place.
          </p>
        </div>
      </CardHeader>
      <CardContent className="relative px-4 pb-4 pt-0 sm:px-6 sm:pb-6">
        <Tabs defaultValue="seo-audit" className="w-full">
          <TabsList className="detail-monitor-tablist grid h-auto w-full grid-cols-2 p-1.5 lg:grid-cols-5">
            <TabsTrigger value="seo-audit">SEO Audit</TabsTrigger>
            <TabsTrigger value="link-health">Link Health</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="real-users">Real Users</TabsTrigger>
            <TabsTrigger value="competitors">Competitors</TabsTrigger>
          </TabsList>

          <TabsContent value="seo-audit" className="mt-5">
            {seoAudit ? (
              <div className="space-y-4">
                <div className="grid gap-4 xl:grid-cols-2">
                  {[
                    {
                      label: "Title tag",
                      value: `${seoAudit.title_tag.status} / ${seoAudit.title_tag.length ?? 0} chars`,
                      pass: seoStatusPass(seoAudit.title_tag.status)
                    },
                    {
                      label: "Meta description",
                      value: `${seoAudit.meta_description.status} / ${seoAudit.meta_description.length ?? 0} chars`,
                      pass: seoStatusPass(seoAudit.meta_description.status)
                    },
                    {
                      label: "Headings",
                      value: `${seoAudit.headings.status} / H1 ${seoAudit.headings.h1_count}, H2 ${seoAudit.headings.h2_count}, H3 ${seoAudit.headings.h3_count}`,
                      pass: seoStatusPass(seoAudit.headings.status)
                    },
                    {
                      label: "Canonical",
                      value: seoAudit.canonical.status,
                      pass: seoAudit.canonical.exists && seoAudit.canonical.self_referencing
                    },
                    {
                      label: "Open Graph",
                      value:
                        seoAudit.og_tags.title && seoAudit.og_tags.description && seoAudit.og_tags.image
                          ? "Complete"
                          : "Needs attention",
                      pass:
                        seoAudit.og_tags.title && seoAudit.og_tags.description && seoAudit.og_tags.image
                    },
                    {
                      label: "Schema markup",
                      value: seoAudit.schema_present ? seoAudit.schema_types.join(", ") || "Detected" : "Missing",
                      pass: seoAudit.schema_present
                    }
                  ].map((item) => (
                    <div key={item.label} className="rounded-2xl border border-border bg-background p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                            {item.label}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-foreground">{item.value}</p>
                        </div>
                        <Badge variant={item.pass ? "success" : "danger"}>{statusFromBoolean(Boolean(item.pass))}</Badge>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
                  <div className="rounded-2xl border border-border bg-background p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">Images missing alt text</p>
                        <p className="mt-2 font-display text-3xl font-semibold">{seoAudit.images_missing_alt}</p>
                      </div>
                      <Badge variant={seoAudit.images_missing_alt ? "warning" : "success"}>
                        {seoAudit.images_missing_alt ? "Needs fixes" : "Clean"}
                      </Badge>
                    </div>
                    <div className="mt-4 space-y-2">
                      {seoAudit.images_missing_alt_urls.length ? (
                        seoAudit.images_missing_alt_urls.slice(0, 5).map((url) => (
                          <div key={url} className="rounded-2xl border border-border/80 bg-card px-3 py-2">
                            <p className="truncate text-sm leading-6 text-muted-foreground" title={url}>
                              {compactDisplayUrl(url, 64)}
                            </p>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">No missing alt text found on the first audited images.</p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border bg-background p-4">
                    <p className="text-sm font-semibold">Fix suggestions</p>
                    <div className="mt-4 space-y-3">
                      {seoAudit.fix_suggestions.length ? (
                        seoAudit.fix_suggestions.map((suggestion, index) => (
                          <div key={`${suggestion.title}-${index}`} className="rounded-2xl border border-border/80 bg-card p-4">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <p className="font-medium">{suggestion.title}</p>
                              <Badge variant={badgeVariantForSeverity(suggestion.severity)}>{suggestion.severity}</Badge>
                            </div>
                            <p className="mt-2 text-sm leading-6 text-muted-foreground">{suggestion.description}</p>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">The latest SEO audit did not flag any immediate fixes.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="rounded-2xl border border-border bg-background p-4 text-sm text-muted-foreground">
                {healthSignalsSyncing && hasCurrentScan
                  ? "Generating SEO audit data from the latest scan. This usually takes a few seconds."
                  : "SEO audit data will appear here after the next completed scan."}
              </p>
            )}
          </TabsContent>

          <TabsContent value="link-health" className="mt-5">
            <LinkHealthPanel
              brokenLinks={brokenLinks ?? null}
              websiteUrl={websiteUrl}
              isHydrating={healthSignalsSyncing && !brokenLinks && hasCurrentScan}
            />
          </TabsContent>

          <TabsContent value="security" className="mt-5">
            <div className="grid gap-4 xl:grid-cols-2">
              <div className="rounded-2xl border border-border bg-background p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">SSL certificate</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {sslCheck
                        ? `${sslCheck.issuer ?? "Unknown issuer"} / ${sslCheck.days_until_expiry ?? "Unknown"} day(s) remaining`
                        : "No SSL check data available yet."}
                    </p>
                  </div>
                  {sslCheck ? <Badge variant={gradeVariant(sslCheck.grade)}>{sslCheck.grade}</Badge> : null}
                </div>
                {sslCheck?.expiry_date ? (
                  <p className="mt-4 text-sm text-muted-foreground">
                    Expires on {new Date(sslCheck.expiry_date).toLocaleDateString()}
                  </p>
                ) : null}
              </div>

              <div className="rounded-2xl border border-border bg-background p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">Security headers</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {securityHeaders ? "Pass/fail view of the browser headers protecting this site." : "No security header audit available yet."}
                    </p>
                  </div>
                  {securityHeaders ? <Badge variant={gradeVariant(securityHeaders.grade)}>{securityHeaders.grade}</Badge> : null}
                </div>
                {securityHeaders ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {[
                      ["HSTS", securityHeaders.hsts],
                      ["CSP", securityHeaders.csp],
                      ["X-Frame-Options", securityHeaders.x_frame_options],
                      ["X-Content-Type-Options", securityHeaders.x_content_type],
                      ["Referrer-Policy", securityHeaders.referrer_policy],
                      ["Permissions-Policy", securityHeaders.permissions_policy]
                    ].map(([label, passed]) => (
                      <div key={String(label)} className="rounded-2xl border border-border/80 bg-card p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium">{label}</p>
                          <Badge variant={passed ? "success" : "danger"}>{statusFromBoolean(Boolean(passed))}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="real-users" className="mt-5">
            <div className="space-y-4">
              <div className="grid gap-4 xl:grid-cols-3">
                <div className="rounded-2xl border border-border bg-background p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">30-day uptime</p>
                  <p className="mt-2 font-display text-3xl font-semibold">{uptimeSummary.percentage}%</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {uptimeSummary.averageResponseMs !== null
                      ? `Average response ${uptimeSummary.averageResponseMs} ms`
                      : "Not enough checks yet to show response time."}
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-background p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Recent incidents</p>
                  <p className="mt-2 font-display text-3xl font-semibold">{uptimeSummary.incidents.length}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Captured from daily health checks and any linked UptimeRobot monitor data.
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-background p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Real-user loading</p>
                  <p className="mt-2 font-display text-3xl font-semibold">{cruxData ? `${cruxData.lcp_good_pct}%` : "--"}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Real visitors with good loading performance from Chrome UX Report data.
                  </p>
                </div>
              </div>

              {cruxData ? (
                <div className="grid gap-4 xl:grid-cols-2">
                  {[
                    ["LCP", cruxData.lcp_good_pct, cruxData.lcp_needs_pct, cruxData.lcp_poor_pct],
                    ["CLS", cruxData.cls_good_pct, cruxData.cls_needs_pct, cruxData.cls_poor_pct],
                    ["INP", cruxData.inp_good_pct, cruxData.inp_needs_pct, cruxData.inp_poor_pct],
                    ["FCP", cruxData.fcp_good_pct, cruxData.fcp_needs_pct, cruxData.fcp_poor_pct],
                    ["TTFB", cruxData.ttfb_good_pct, cruxData.ttfb_needs_pct, cruxData.ttfb_poor_pct]
                  ].map(([label, good, needs, poor]) => (
                    <div key={String(label)} className="rounded-2xl border border-border bg-background p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold">{label}</p>
                        <Badge variant={Number(good) >= 75 ? "success" : Number(poor) >= 25 ? "danger" : "warning"}>
                          {Number(good)}% good
                        </Badge>
                      </div>
                      <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                        <p>Good: {good}%</p>
                        <p>Needs improvement: {needs}%</p>
                        <p>Poor: {poor}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-2xl border border-border bg-background p-4 text-sm text-muted-foreground">
                  Real-user Chrome UX Report data is not available for this origin yet.
                </p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="competitors" className="mt-5">
            <div className="space-y-4">
              <div className="rounded-2xl border border-border bg-background p-4">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-semibold">Tracked competitor URLs</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Add up to 3 competitors, one per line or separated by commas.
                    </p>
                    <Textarea
                      className="mt-4 min-h-[120px]"
                      value={competitorInput}
                      onChange={(event) => onCompetitorInputChange(event.target.value)}
                      placeholder="https://competitor-one.com&#10;https://competitor-two.com"
                    />
                  </div>
                  <Button onClick={onSaveCompetitors} disabled={isPending} className="shrink-0">
                    Save competitors
                  </Button>
                </div>
              </div>

              {competitorEntries.length ? (
                <div className="grid gap-4 xl:grid-cols-2">
                  {competitorEntries.map((competitor) => {
                    const competitorOverall = Math.round(
                      (competitor.performance + competitor.seo + competitor.accessibility + competitor.best_practices) / 4
                    );

                    return (
                      <div key={competitor.competitor_url} className="rounded-2xl border border-border bg-background p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold" title={competitor.competitor_url}>
                              {compactDisplayUrl(competitor.competitor_url, 72)}
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              Last scanned {new Date(competitor.scanned_at).toLocaleDateString()}
                            </p>
                          </div>
                          <Badge variant={competitorOverall > (healthScore?.overall ?? 0) ? "warning" : "success"}>
                            {competitorOverall}/100
                          </Badge>
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <MetricTile label="Performance" shortLabel="Perf." value={competitor.performance} />
                          <MetricTile label="SEO" shortLabel="SEO" value={competitor.seo} />
                          <MetricTile label="Accessibility" shortLabel="Access." value={competitor.accessibility} />
                          <MetricTile label="Best Practices" shortLabel="Best Prac." value={competitor.best_practices} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="rounded-2xl border border-border bg-background p-4 text-sm text-muted-foreground">
                  Add competitor URLs above to start daily comparison tracking for this website.
                </p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

export default function WebsiteDetailPage({ params }: { params: { id: string } }) {
  const { user } = useUser();
  const [data, setData] = useState<WebsiteDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [plainLanguage, setPlainLanguage] = useState<WebsiteScanPlainEnglish | null>(null);
  const [plainLanguageLoading, setPlainLanguageLoading] = useState(false);
  const [healthSignalsSyncing, setHealthSignalsSyncing] = useState(false);
  const [healthSignalRetryTick, setHealthSignalRetryTick] = useState(0);
  const [competitorInput, setCompetitorInput] = useState("");
  const [recipientDraft, setRecipientDraft] = useState("");
  const [reportRecipients, setReportRecipients] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const { paywallFeature, isExpired, closePaywall, requireAccess } = useTrialPaywall(user);
  const healthSignalAttemptCountsRef = useRef(new Map<string, number>());
  const healthSignalRetryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHealthSignalRetryTimeout = () => {
    if (healthSignalRetryTimeoutRef.current) {
      clearTimeout(healthSignalRetryTimeoutRef.current);
      healthSignalRetryTimeoutRef.current = null;
    }
  };

  const scheduleHealthSignalRetry = (attemptKey: string, attemptCount: number) => {
    clearHealthSignalRetryTimeout();
    const delayMs = Math.min(2500 * attemptCount, 8000);

    healthSignalRetryTimeoutRef.current = setTimeout(() => {
      healthSignalRetryTimeoutRef.current = null;
      console.warn("[website:health-signals] Retrying missing health signal hydration.", {
        websiteId: params.id,
        attemptKey,
        attemptCount,
        delayMs
      });
      setHealthSignalRetryTick((value) => value + 1);
    }, delayMs);
  };

  const refetch = async (options?: { background?: boolean }) => {
    if (!options?.background) {
      setLoading(true);
    }

    try {
      const response = await fetchJson<WebsiteDetailResponse>(`/api/websites/${params.id}`);
      setData(response);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load website.");
    } finally {
      if (!options?.background) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    void refetch();
  }, [params.id]);

  useEffect(() => {
    setCompetitorInput((data?.competitor_urls ?? []).join("\n"));
  }, [data?.competitor_urls]);

  useEffect(() => {
    setReportRecipients(normalizeRecipientEmails(data?.report_recipients ?? []));
  }, [data?.report_recipients]);

  const currentScan = data?.scans?.[0] ?? null;
  const previousScan = data?.scans?.[1] ?? null;
  const currentScanFailed = currentScan?.scan_status === "failed";
  const scoreDelta =
    currentScan && previousScan ? currentScan.performance_score - previousScan.performance_score : null;
  const healthScore = data?.health_score ?? null;
  const seoAudit = normalizeSeoAuditRecord(data?.seo_audit ?? null);
  const sslCheck = data?.ssl_check ?? null;
  const securityHeaders = data?.security_headers ?? null;
  const cruxData = data?.crux_data ?? null;
  const brokenLinks = normalizeBrokenLinksRecord(data?.broken_links ?? null);
  const uptimeSummary = buildUptimeSummary(data?.uptime_checks ?? []);
  const competitorEntries = latestCompetitorEntries(data?.competitor_scans ?? []);
  const businessImpact = buildSiteBusinessImpact(currentScan ?? null);

  useEffect(() => {
    healthSignalAttemptCountsRef.current.clear();
    clearHealthSignalRetryTimeout();
    setHealthSignalRetryTick(0);

    return () => {
      clearHealthSignalRetryTimeout();
    };
  }, [currentScan?.id, params.id]);

  const accessibilityViolations = useMemo(
    () => currentScan?.accessibility_violations ?? [],
    [currentScan]
  );

  useEffect(() => {
    if (!currentScan || currentScanFailed) {
      setPlainLanguage(null);
      setPlainLanguageLoading(false);
      return;
    }

    let cancelled = false;

    setPlainLanguageLoading(true);

    void fetchJson<WebsiteScanPlainEnglish>(`/api/scan/${currentScan.id}/plain-language`)
      .then((response) => {
        if (!cancelled) {
          setPlainLanguage(response);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPlainLanguage(buildLocalPlainLanguage(currentScan));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setPlainLanguageLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentScan?.id, currentScanFailed]);

  useEffect(() => {
    if (!currentScan || currentScanFailed) {
      clearHealthSignalRetryTimeout();
      return;
    }

    const needsSeoAudit = !seoAudit;
    const needsLinkHealth = !brokenLinks;

    if (!needsSeoAudit && !needsLinkHealth) {
      clearHealthSignalRetryTimeout();
      return;
    }

    const attemptKey = [
      currentScan.id,
      needsSeoAudit ? "seo" : null,
      needsLinkHealth ? "links" : null
    ]
      .filter(Boolean)
      .join(":");

    if (!attemptKey) {
      return;
    }

    const maxAttempts = 3;
    const nextAttemptCount = (healthSignalAttemptCountsRef.current.get(attemptKey) ?? 0) + 1;

    if (nextAttemptCount > maxAttempts) {
      return;
    }

    healthSignalAttemptCountsRef.current.set(attemptKey, nextAttemptCount);
    clearHealthSignalRetryTimeout();

    let cancelled = false;
    setHealthSignalsSyncing(true);

    void Promise.allSettled([
      needsSeoAudit
        ? fetchJson(`/api/scan/seo`, {
            method: "POST",
            body: JSON.stringify({
              websiteId: params.id,
              scanId: currentScan.id
            })
          })
        : Promise.resolve(null),
      needsLinkHealth
        ? fetchJson(`/api/scan/links`, {
            method: "POST",
            body: JSON.stringify({
              websiteId: params.id,
              scanId: currentScan.id
            })
          })
        : Promise.resolve(null)
    ])
      .then(async (results) => {
        if (cancelled) {
          return;
        }

        const fulfilled = results.some((result) => result.status === "fulfilled");
        const rejectedMessages = results
          .filter((result): result is PromiseRejectedResult => result.status === "rejected")
          .map((result) =>
            result.reason instanceof Error ? result.reason.message : "Unknown health signal error."
          );

        if (fulfilled) {
          await refetch({ background: true });
          return;
        }

        if (nextAttemptCount < maxAttempts) {
          scheduleHealthSignalRetry(attemptKey, nextAttemptCount);
          return;
        }

        console.error("[website:health-signals] Failed to hydrate SEO audit or link health data.", {
          websiteId: params.id,
          scanId: currentScan.id,
          attemptKey,
          attempts: nextAttemptCount,
          errors: rejectedMessages
        });
        toast.error(
          "SEO audit and link health data are taking longer than expected. Try refreshing again in a moment."
        );
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) {
          setHealthSignalsSyncing(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [brokenLinks, currentScan, currentScanFailed, healthSignalRetryTick, params.id, seoAudit]);

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

  const saveCompetitors = () =>
    startTransition(async () => {
      try {
        await fetchJson(`/api/websites/${params.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            competitor_urls: competitorInput
              .split(/[\n,]+/)
              .map((item) => item.trim())
              .filter(Boolean)
              .slice(0, 3)
          })
        });
        toast.success("Competitor URLs updated.");
        await refetch();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to update competitor URLs.");
      }
    });

  const addRecipient = () => {
    const nextEmail = recipientDraft.trim().toLowerCase();

    if (!nextEmail) {
      return;
    }

    if (!isValidRecipientEmail(nextEmail)) {
      toast.error("Enter a valid email address before adding it.");
      return;
    }

    if (reportRecipients.includes(nextEmail)) {
      toast.error("That recipient is already added for this website.");
      return;
    }

    setReportRecipients((current) => [...current, nextEmail]);
    setRecipientDraft("");
  };

  const removeRecipient = (email: string) => {
    setReportRecipients((current) => current.filter((item) => item !== email));
  };

  const saveReportRecipients = () =>
    startTransition(async () => {
      const draft = recipientDraft.trim().toLowerCase();

      if (draft && !isValidRecipientEmail(draft)) {
        toast.error("Enter a valid email address before saving.");
        return;
      }

      const nextRecipients = normalizeRecipientEmails(draft ? [...reportRecipients, draft] : reportRecipients);

      try {
        await fetchJson(`/api/websites/${params.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            report_recipients: nextRecipients
          })
        });

        setRecipientDraft("");
        setReportRecipients(nextRecipients);
        toast.success(
          nextRecipients.length
            ? "Website report recipients updated."
            : "All extra report recipients removed for this website."
        );
        await refetch({ background: true });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to update report recipients.");
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
    <div className="space-y-8 sm:space-y-10">
      <PageHeader
        eyebrow="Website detail"
        title={data.label}
        description={data.url}
        actions={
          <div className="w-full rounded-[1.5rem] border border-slate-200/90 bg-white/80 p-2 shadow-[0_18px_48px_-28px_rgba(15,23,42,0.16)] backdrop-blur dark:border-white/8 dark:bg-card/70 dark:shadow-[0_18px_48px_-28px_rgba(15,23,42,0.58)] xl:w-auto">
            <div className="grid w-full gap-2 sm:grid-cols-2 xl:w-auto xl:grid-cols-3">
              <Button
                variant="outline"
                onClick={runScan}
                disabled={isPending}
                className="h-11 w-full justify-center rounded-xl border-slate-200/90 bg-white/75 shadow-sm dark:border-white/10 dark:bg-background/70 sm:h-12"
              >
              <WandSparkles className="h-4 w-4" />
              Run scan
              </Button>
              <Button
                variant="outline"
                onClick={() => requireAccess("download_report", generateReport)}
                disabled={isPending}
                className="h-11 w-full justify-center rounded-xl border-slate-200/90 bg-white/75 shadow-sm dark:border-white/10 dark:bg-background/70 sm:h-12"
              >
                <FileDown className="h-4 w-4" />
                Generate PDF
              </Button>
              <Button
                onClick={() => requireAccess("download_report", emailReport)}
                disabled={isPending}
                className="h-11 w-full justify-center rounded-xl sm:h-12 sm:col-span-2 xl:col-span-1"
              >
                <Mail className="h-4 w-4" />
                Email report
              </Button>
            </div>
          </div>
        }
      />

      <Card className="overflow-hidden border-primary/15 bg-primary/[0.06]">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                Business impact layer
              </p>
              <p className="mt-2 text-lg font-semibold leading-8 text-foreground">
                {businessImpact.headline}
              </p>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">
                {businessImpact.detail}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[19rem]">
              <div className="rounded-2xl border border-primary/12 bg-background/80 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Estimated leak
                </p>
                <p className="mt-2 font-display text-3xl font-semibold text-rose-500 dark:text-rose-400">
                  {businessImpact.estimatedLeak}%
                </p>
              </div>
              <div className="rounded-2xl border border-primary/12 bg-background/80 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Improvement potential
                </p>
                <p className="mt-2 font-display text-3xl font-semibold text-emerald-500 dark:text-emerald-400">
                  {businessImpact.improvementPotential}%
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3 sm:pb-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Report recipients</CardTitle>
              <CardDescription>
                Manage the extra email addresses that should receive reports for this website.
              </CardDescription>
            </div>
            <Badge variant={data.email_reports_enabled ? "success" : "outline"} className="self-start">
              {data.email_reports_enabled ? "Auto email enabled" : "Manual send only"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 pt-0">
          <div className="rounded-2xl border border-border bg-background p-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div className="flex-1 space-y-2">
                <Label htmlFor="website-recipient-email">Add recipient email</Label>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Input
                    id="website-recipient-email"
                    value={recipientDraft}
                    onChange={(event) => setRecipientDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addRecipient();
                      }
                    }}
                    placeholder="client@example.com"
                  />
                  <Button type="button" variant="outline" onClick={addRecipient} className="sm:w-auto">
                    <Plus className="h-4 w-4" />
                    Add recipient
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Your main account email still receives reports. These are extra per-website recipients for manual and automatic sends.
                </p>
              </div>
              <Button type="button" onClick={saveReportRecipients} disabled={isPending} className="shrink-0">
                Save recipients
              </Button>
            </div>
          </div>

          {reportRecipients.length ? (
            <div className="flex flex-wrap gap-2">
              {reportRecipients.map((email) => (
                <div
                  key={email}
                  className="inline-flex max-w-full items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-sm"
                >
                  <span className="truncate">{email}</span>
                  <button
                    type="button"
                    onClick={() => removeRecipient(email)}
                    className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
                    aria-label={`Remove ${email}`}
                    title={`Remove ${email}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-background p-4 text-sm text-muted-foreground">
              No extra recipients yet. Reports will go to your account email until you add website-specific recipients here.
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DetailSignalCard
          icon={Activity}
          accent="blue"
          eyebrow="Overall health"
          value={healthScore?.overall ?? "--"}
          description="Weighted across performance, SEO, security, uptime, and accessibility."
          badge={
            healthScore ? (
              <Badge variant={healthScore.overall >= 85 ? "success" : healthScore.overall >= 60 ? "warning" : "danger"}>
                {healthScore.overall >= 85 ? "Strong" : healthScore.overall >= 60 ? "Watch" : "Needs work"}
              </Badge>
            ) : null
          }
          footnote="This is the fastest way to see whether the site is trending healthy overall."
        />

        <DetailSignalCard
          icon={ShieldCheck}
          accent="emerald"
          eyebrow="SSL"
          value={
            sslCheck?.days_until_expiry !== null && sslCheck?.days_until_expiry !== undefined
              ? `${sslCheck.days_until_expiry} days`
              : "Unknown"
          }
          valueClassName="text-[2rem] sm:text-[2.25rem]"
          description={
            sslCheck?.expiry_date
              ? `Expires ${new Date(sslCheck.expiry_date).toLocaleDateString()}`
              : "No SSL expiry date recorded yet."
          }
          badge={
            sslCheck ? (
              <Badge variant={gradeVariant(sslCheck.grade)}>
                {sslCheck.grade === "green"
                  ? "Healthy"
                  : sslCheck.grade === "orange"
                    ? "Renew soon"
                    : sslCheck.grade === "red"
                      ? "Urgent"
                      : "Critical"}
              </Badge>
            ) : null
          }
          footnote={sslCheck?.issuer ? `Issued by ${sslCheck.issuer}` : "SSL issuer data will appear after the next successful check."}
        />

        <DetailSignalCard
          icon={Shield}
          accent="amber"
          eyebrow="Security headers"
          value={securityHeaders?.grade ?? "--"}
          description={securityHeaders ? "Grade based on six key browser security headers." : "Header audit not available yet."}
          badge={securityHeaders ? <Badge variant={gradeVariant(securityHeaders.grade)}>{securityHeaders.grade}</Badge> : null}
          footnote={
            securityHeaders
              ? "HSTS, CSP, frame protection, content-type protection, referrer policy, and permissions policy are all checked."
              : "Run another scan to refresh this audit."
          }
        />

        <DetailSignalCard
          icon={TrendingUp}
          accent="rose"
          eyebrow="30-day uptime"
          value={`${uptimeSummary.percentage}%`}
          description={
            uptimeSummary.averageResponseMs !== null
              ? `Average response ${uptimeSummary.averageResponseMs} ms`
              : "Waiting for enough uptime samples."
          }
          badge={
            <Badge variant={uptimeSummary.percentage >= 99 ? "success" : uptimeSummary.percentage >= 95 ? "warning" : "danger"}>
              {uptimeSummary.incidents.length} incidents
            </Badge>
          }
          footnote="Built from the latest uptime checks and any connected UptimeRobot monitor data."
        />
      </div>

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
                    <WandSparkles className="h-4 w-4" />
                    Retry scan
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">Latest score pulse</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Your current Lighthouse-style snapshot across speed, visibility, accessibility, and best-practice quality.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">Scanned {new Date(currentScan.scanned_at).toLocaleDateString()}</Badge>
                  {scoreDelta !== null ? (
                    <Badge variant={scoreDelta > 0 ? "success" : scoreDelta < 0 ? "danger" : "outline"}>
                      {scoreDelta > 0 ? `Up ${scoreDelta}` : scoreDelta < 0 ? `Down ${Math.abs(scoreDelta)}` : "No change"}
                    </Badge>
                  ) : null}
                </div>
              </div>
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
                <Card className="detail-monitor-card relative overflow-hidden">
                  <div className="detail-monitor-inset pointer-events-none absolute inset-px rounded-[1.45rem]" />
                  <div className="pointer-events-none absolute left-0 top-0 h-28 w-48 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.12),transparent_72%)] blur-2xl" />
                  <CardHeader className="relative pb-3 sm:pb-5">
                    <CardTitle>Score trend (last 30 days)</CardTitle>
                    <CardDescription>Performance, SEO, and accessibility movement across recent scans.</CardDescription>
                  </CardHeader>
                  <CardContent className="relative px-3 pb-3 pt-0 sm:px-6 sm:pb-6">
                    <ScoreTrendChart scans={data.scans.slice(0, 30)} />
                  </CardContent>
                </Card>
                <Card className="detail-monitor-card relative overflow-hidden">
                  <div className="detail-monitor-inset pointer-events-none absolute inset-px rounded-[1.45rem]" />
                  <div className="pointer-events-none absolute right-0 top-0 h-28 w-44 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.12),transparent_72%)] blur-2xl" />
                  <CardHeader className="relative pb-3 sm:pb-5">
                    <CardTitle>Mobile vs desktop</CardTitle>
                    <CardDescription>Compare how your main audit scores land across device types.</CardDescription>
                  </CardHeader>
                  <CardContent className="relative px-3 pb-3 pt-0 sm:px-6 sm:pb-6">
                    <DeviceScoreChart scan={currentScan} />
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
                <Card className="detail-monitor-card relative overflow-hidden">
                  <div className="detail-monitor-inset pointer-events-none absolute inset-px rounded-[1.45rem]" />
                  <CardHeader className="relative gap-2 pb-3 sm:pb-6">
                    <CardTitle>Core Web Vitals</CardTitle>
                    <CardDescription>Google&apos;s latest loading, responsiveness, and stability checks for this site.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3 px-4 pb-4 pt-0 sm:px-6 sm:pb-6 md:grid-cols-2">
                    {[
                      ["lcp", "Largest Contentful Paint", `${Math.round(currentScan.lcp ?? 0)} ms`],
                      ["fid", "First Input Delay", `${Math.round(currentScan.fid ?? 0)} ms`],
                      ["cls", "Cumulative Layout Shift", `${currentScan.cls ?? 0}`],
                      ["tbt", "Total Blocking Time", `${Math.round(currentScan.tbt ?? 0)} ms`]
                    ].map(([metricKey, label, value]) => {
                      const status = getCoreVitalStatus(
                        metricKey as "lcp" | "fid" | "cls" | "tbt",
                        metricKey === "lcp"
                          ? currentScan.lcp
                          : metricKey === "fid"
                            ? currentScan.fid
                            : metricKey === "cls"
                              ? currentScan.cls
                              : currentScan.tbt
                      );

                      return (
                        <div key={label} className="rounded-2xl border border-border bg-background/90 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <p className="max-w-[14rem] text-[10px] uppercase leading-5 tracking-[0.16em] text-muted-foreground sm:text-xs sm:tracking-[0.18em]">
                              {label}
                            </p>
                            <Badge variant={status.variant}>{status.label}</Badge>
                          </div>
                          <p className="mt-3 font-display text-2xl font-semibold leading-none sm:text-[1.75rem]">{value}</p>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
                <Card className="detail-monitor-card relative overflow-hidden">
                  <div className="detail-monitor-inset pointer-events-none absolute inset-px rounded-[1.45rem]" />
                  <CardHeader className="relative flex flex-col gap-3 pb-3 sm:pb-6 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-2">
                      <CardTitle>Accessibility violations</CardTitle>
                      <CardDescription>Most important accessibility blockers from the latest audit.</CardDescription>
                    </div>
                    <Badge variant={accessibilityViolations.length ? "warning" : "success"} className="self-start">
                      {accessibilityViolations.length} issue{accessibilityViolations.length === 1 ? "" : "s"}
                    </Badge>
                  </CardHeader>
                  <CardContent className="space-y-3 px-4 pb-4 pt-0 sm:px-6 sm:pb-6">
                    {accessibilityViolations.length ? (
                      accessibilityViolations.slice(0, 6).map((violation, index) => (
                        <div key={index} className="rounded-2xl border border-border bg-background/90 p-4">
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
                      <div className="flex min-h-[16rem] flex-col items-center justify-center rounded-2xl border border-dashed border-emerald-500/20 bg-emerald-500/5 px-6 text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/12 text-emerald-400">
                          <ShieldCheck className="h-5 w-5" />
                        </div>
                        <p className="mt-4 font-medium">No accessibility violations recorded</p>
                        <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                          The latest accessibility pass did not return any blocking issues for this website.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}

          {!currentScanFailed ? (
            <Card>
              <CardHeader className="gap-4 pb-3 sm:pb-6">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-1">
                    <CardTitle>AI scan review</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Plain-English issues, quick wins, and a cleaned developer view for this scan.
                    </p>
                  </div>
                  {plainLanguage ? (
                    <Badge variant={plainLanguage.provider === "template" ? "outline" : "default"} className="self-start">
                      {plainLanguage.provider === "template" ? "Clean fallback" : "AI translated"}
                    </Badge>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-0 sm:px-6 sm:pb-6">
                {plainLanguageLoading ? (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-border bg-background p-4">
                      <p className="text-sm font-medium">AI is analyzing your website...</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Turning technical scan data into plain-English issues and quick wins.
                      </p>
                    </div>
                    <div className="grid gap-3 xl:grid-cols-3">
                      {Array.from({ length: 3 }).map((_, index) => (
                        <Skeleton key={index} className="h-52 w-full rounded-2xl" />
                      ))}
                    </div>
                  </div>
                ) : plainLanguage ? (
                  <div className="space-y-5">
                    <div className="detail-monitor-summary p-4 sm:p-5">
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                        <div className="flex flex-wrap gap-2">
                          <div className="inline-flex items-center gap-2 rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-rose-400">
                            <span className="h-2 w-2 rounded-full bg-rose-400" />
                            High {plainLanguage.severity_counts.high}
                          </div>
                          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-amber-400">
                            <span className="h-2 w-2 rounded-full bg-amber-400" />
                            Medium {plainLanguage.severity_counts.medium}
                          </div>
                          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-400">
                            <span className="h-2 w-2 rounded-full bg-emerald-400" />
                            Low {plainLanguage.severity_counts.low}
                          </div>
                        </div>
                        <div className="hidden flex flex-wrap gap-2">
                          <div className="rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-rose-500 dark:text-rose-400">
                            🔴 {plainLanguage.severity_counts.high} High
                          </div>
                          <div className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-amber-600 dark:text-amber-400">
                            🟡 {plainLanguage.severity_counts.medium} Medium
                          </div>
                          <div className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-500 dark:text-emerald-400">
                            🟢 {plainLanguage.severity_counts.low} Low
                          </div>
                        </div>
                        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{plainLanguage.summary}</p>
                      </div>
                    </div>

                    <Tabs defaultValue="issues" className="w-full">
                      <TabsList className="detail-monitor-tablist grid h-auto w-full grid-cols-3 p-1.5">
                        <TabsTrigger value="issues">Issues</TabsTrigger>
                        <TabsTrigger value="quick-wins">Quick Wins</TabsTrigger>
                        <TabsTrigger value="raw-data">Raw Data</TabsTrigger>
                      </TabsList>

                      <TabsContent value="issues" className="mt-5">
                        {plainLanguage.issues.length ? (
                          <div className="grid gap-4 xl:grid-cols-2">
                            {plainLanguage.issues.map((issue) => (
                              <div key={issue.id} className="rounded-2xl border border-border bg-background p-4 sm:p-5">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                  <div className="space-y-1 min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <Badge variant={badgeVariantForSeverity(issue.severity)} className="self-start">
                                        {issue.severity}
                                      </Badge>
                                      <span className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                                        {issue.category}
                                      </span>
                                    </div>
                                    <p className="text-lg font-semibold leading-tight">{issue.title}</p>
                                  </div>
                                </div>

                                <div className="mt-4 grid gap-3 text-sm leading-6 text-muted-foreground">
                                  <div className="rounded-2xl border border-border/80 bg-card/60 p-3">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground">
                                      What&apos;s happening
                                    </p>
                                    <p className="mt-1">{issue.whats_happening}</p>
                                  </div>
                                  <div className="rounded-2xl border border-border/80 bg-card/60 p-3">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground">
                                      Why it matters
                                    </p>
                                    <p className="mt-1">{issue.business_impact}</p>
                                  </div>
                                  <div className="rounded-2xl border border-border/80 bg-card/60 p-3">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground">
                                      How to fix
                                    </p>
                                    <p className="mt-1">{issue.how_to_fix}</p>
                                  </div>
                                </div>

                                <div className="hidden mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                                  <span>⏱️ {issue.time_estimate}</span>
                                  <span>
                                    {difficultyStars(issue.difficulty)} {issue.difficulty}
                                  </span>
                                </div>
                                <div className="mt-4 flex flex-wrap items-center gap-2">
                                  <Badge variant="outline" className="gap-1.5 rounded-full px-3 py-1 text-xs">
                                    <Clock3 className="h-3.5 w-3.5" />
                                    {issue.time_estimate}
                                  </Badge>
                                  <Badge variant="outline" className="gap-1.5 rounded-full px-3 py-1 text-xs">
                                    <WandSparkles className="h-3.5 w-3.5" />
                                    {issue.difficulty}
                                  </Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="rounded-2xl border border-border bg-background p-4 text-sm text-muted-foreground">
                            No notable issues were found in the latest scan.
                          </p>
                        )}
                      </TabsContent>

                      <TabsContent value="quick-wins" className="mt-5">
                        {plainLanguage.recommendations.length ? (
                          <div className="grid gap-4 xl:grid-cols-2">
                            {plainLanguage.recommendations.map((recommendation, index) => (
                              <div key={`${recommendation.title}-${index}`} className="rounded-2xl border border-border bg-background p-4 sm:p-5">
                                <div className="flex items-start gap-3">
                                  <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                                    <WandSparkles className="h-5 w-5" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="hidden text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
                                      ⚡ Quick Win
                                    </p>
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
                                      Quick win
                                    </p>
                                    <p className="mt-1 text-lg font-semibold leading-tight">{recommendation.title}</p>
                                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{recommendation.description}</p>
                                    <div className="hidden mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                                      <span>
                                        {difficultyStars(recommendation.difficulty)} {recommendation.difficulty}
                                      </span>
                                      <span>⏱️ {recommendation.time_estimate}</span>
                                      <Badge variant={badgeVariantForSeverity(recommendation.priority)} className="self-start">
                                        {recommendation.priority}
                                      </Badge>
                                    </div>
                                    <div className="mt-4 flex flex-wrap items-center gap-2">
                                      <Badge variant="outline" className="gap-1.5 rounded-full px-3 py-1 text-xs">
                                        <WandSparkles className="h-3.5 w-3.5" />
                                        {recommendation.difficulty}
                                      </Badge>
                                      <Badge variant="outline" className="gap-1.5 rounded-full px-3 py-1 text-xs">
                                        <Clock3 className="h-3.5 w-3.5" />
                                        {recommendation.time_estimate}
                                      </Badge>
                                      <Badge variant={badgeVariantForSeverity(recommendation.priority)} className="rounded-full px-3 py-1 text-xs">
                                        {recommendation.priority}
                                      </Badge>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="rounded-2xl border border-border bg-background p-4 text-sm text-muted-foreground">
                            No extra quick wins were generated for this scan.
                          </p>
                        )}
                      </TabsContent>

                      <TabsContent value="raw-data" className="mt-5">
                        <div className="rounded-2xl border border-dashed border-border bg-background p-4">
                          <p className="text-sm font-medium">Developer view</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Original scan output is cleaned for readability here, with links and noisy syntax removed.
                          </p>
                        </div>

                        <div className="mt-4 grid gap-4 xl:grid-cols-2">
                          <div className="space-y-3">
                            <p className="text-sm font-semibold">Raw issues</p>
                            {plainLanguage.raw_issues.length ? (
                              plainLanguage.raw_issues.map((issue) => (
                                <div key={issue.id} className="rounded-2xl border border-border bg-background p-4">
                                  <div className="flex flex-wrap items-start justify-between gap-2">
                                    <p className="min-w-0 flex-1 font-medium leading-6">{issue.title}</p>
                                    <Badge variant={badgeVariantForSeverity(issue.severity)} className="self-start">
                                      {issue.severity}
                                    </Badge>
                                  </div>
                                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{issue.description}</p>
                                  {issue.device ? (
                                    <p className="mt-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                                      {issue.device === "both" ? "Mobile + desktop" : issue.device}
                                    </p>
                                  ) : null}
                                </div>
                              ))
                            ) : (
                              <p className="rounded-2xl border border-border bg-background p-4 text-sm text-muted-foreground">
                                No raw issues were returned for this scan.
                              </p>
                            )}
                          </div>

                          <div className="space-y-3">
                            <p className="text-sm font-semibold">Raw recommendations</p>
                            {plainLanguage.raw_recommendations.length ? (
                              plainLanguage.raw_recommendations.map((recommendation) => (
                                <div key={recommendation.id} className="rounded-2xl border border-border bg-background p-4">
                                  <div className="flex flex-wrap items-start justify-between gap-2">
                                    <p className="min-w-0 flex-1 font-medium leading-6">{recommendation.title}</p>
                                    <Badge variant={badgeVariantForSeverity(recommendation.priority)} className="self-start">
                                      {recommendation.priority}
                                    </Badge>
                                  </div>
                                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                    {recommendation.description}
                                  </p>
                                  {recommendation.device ? (
                                    <p className="mt-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                                      {recommendation.device === "both" ? "Mobile + desktop" : recommendation.device}
                                    </p>
                                  ) : null}
                                </div>
                              ))
                            ) : (
                              <p className="rounded-2xl border border-border bg-background p-4 text-sm text-muted-foreground">
                                No raw recommendations were returned for this scan.
                              </p>
                            )}
                          </div>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </div>
                ) : (
                  <p className="rounded-2xl border border-border bg-background p-4 text-sm text-muted-foreground">
                    No scan insights are available yet for this website.
                  </p>
                )}
              </CardContent>
            </Card>
          ) : null}

          <WebsiteHealthSignalsCard
            websiteUrl={data.url}
            seoAudit={seoAudit}
            brokenLinks={brokenLinks}
            sslCheck={sslCheck}
            securityHeaders={securityHeaders}
            cruxData={cruxData}
            uptimeSummary={uptimeSummary}
            competitorEntries={competitorEntries}
            competitorInput={competitorInput}
            onCompetitorInputChange={setCompetitorInput}
            onSaveCompetitors={saveCompetitors}
            isPending={isPending}
            healthScore={healthScore}
            healthSignalsSyncing={healthSignalsSyncing}
            hasCurrentScan={Boolean(currentScan)}
          />

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
        <>
          <EmptyState
            title="No scans yet"
            description="Run the first scan to generate scores, accessibility checks, and your first white-label report."
          />
          <WebsiteHealthSignalsCard
            websiteUrl={data.url}
            seoAudit={seoAudit}
            brokenLinks={brokenLinks}
            sslCheck={sslCheck}
            securityHeaders={securityHeaders}
            cruxData={cruxData}
            uptimeSummary={uptimeSummary}
            competitorEntries={competitorEntries}
            competitorInput={competitorInput}
            onCompetitorInputChange={setCompetitorInput}
            onSaveCompetitors={saveCompetitors}
            isPending={isPending}
            healthScore={healthScore}
            healthSignalsSyncing={healthSignalsSyncing}
            hasCurrentScan={Boolean(currentScan)}
          />
        </>
      )}
      <TrialPaywall
        isOpen={paywallFeature !== null}
        onClose={closePaywall}
        feature={paywallFeature ?? "download_report"}
        isExpired={isExpired}
      />
    </div>
  );
}
