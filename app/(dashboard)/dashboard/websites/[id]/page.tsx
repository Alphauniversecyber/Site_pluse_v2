"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { AlertTriangle, FileDown, Mail, WandSparkles } from "lucide-react";
import { toast } from "sonner";

import { DeviceScoreChart } from "@/components/charts/device-score-chart";
import { ScoreTrendChart } from "@/components/charts/score-trend-chart";
import { EmptyState } from "@/components/dashboard/empty-state";
import { LinkHealthPanel } from "@/components/dashboard/link-health-panel";
import { MetricTile } from "@/components/dashboard/metric-tile";
import { PageHeader } from "@/components/dashboard/page-header";
import { ScoreRing } from "@/components/dashboard/score-ring";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type {
  CompetitorScanRecord,
  CruxDataRecord,
  PlainLanguageDifficulty,
  ScanResult,
  SecurityHeadersRecord,
  Severity,
  Website,
  WebsiteScanPlainEnglish
} from "@/types";
import { fetchJson } from "@/lib/api-client";
import { buildUptimeSummary } from "@/lib/health-score";
import { getFriendlyScanFailureMessage } from "@/lib/scan-errors";

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

function WebsiteHealthSignalsEmptyStateCard(input: {
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
    healthScore
  } = input;

  return (
    <Card>
      <CardHeader className="gap-4 pb-3 sm:pb-6">
        <div className="space-y-1">
          <CardTitle>Website health signals</CardTitle>
          <p className="text-sm text-muted-foreground">
            On-page SEO, link health, security, uptime, real user data, and competitor tracking in one place.
          </p>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0 sm:px-6 sm:pb-6">
        <Tabs defaultValue="seo-audit" className="w-full">
          <TabsList className="grid h-auto w-full grid-cols-2 lg:grid-cols-5">
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
                      value: `${seoAudit.title_tag.status} • ${seoAudit.title_tag.length ?? 0} chars`,
                      pass: seoAudit.title_tag.exists
                    },
                    {
                      label: "Meta description",
                      value: `${seoAudit.meta_description.status} • ${seoAudit.meta_description.length ?? 0} chars`,
                      pass: seoAudit.meta_description.exists
                    },
                    {
                      label: "Headings",
                      value: `${seoAudit.headings.status} • H1 ${seoAudit.headings.h1_count}, H2 ${seoAudit.headings.h2_count}, H3 ${seoAudit.headings.h3_count}`,
                      pass: seoAudit.headings.status === "Good"
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
                    <p className="text-sm font-semibold">Images missing alt text</p>
                    <p className="mt-2 font-display text-3xl font-semibold">{seoAudit.images_missing_alt}</p>
                    <div className="mt-4 space-y-2">
                      {seoAudit.images_missing_alt_urls.length ? (
                        seoAudit.images_missing_alt_urls.map((url) => (
                          <p key={url} className="break-all text-sm leading-6 text-muted-foreground">
                            {url}
                          </p>
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
                SEO audit data will appear here after the next completed scan.
              </p>
            )}
          </TabsContent>

          <TabsContent value="link-health" className="mt-5">
            <LinkHealthPanel brokenLinks={brokenLinks ?? null} websiteUrl={websiteUrl} />
          </TabsContent>

          <TabsContent value="security" className="mt-5">
            <div className="grid gap-4 xl:grid-cols-2">
              <div className="rounded-2xl border border-border bg-background p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">SSL certificate</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {sslCheck
                        ? `${sslCheck.issuer ?? "Unknown issuer"} • ${sslCheck.days_until_expiry ?? "Unknown"} day(s) remaining`
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
                            <p className="break-all text-sm font-semibold">{competitor.competitor_url}</p>
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
  const [data, setData] = useState<WebsiteDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [plainLanguage, setPlainLanguage] = useState<WebsiteScanPlainEnglish | null>(null);
  const [plainLanguageLoading, setPlainLanguageLoading] = useState(false);
  const [competitorInput, setCompetitorInput] = useState("");
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

  useEffect(() => {
    setCompetitorInput((data?.competitor_urls ?? []).join("\n"));
  }, [data?.competitor_urls]);

  const currentScan = data?.scans?.[0] ?? null;
  const previousScan = data?.scans?.[1] ?? null;
  const currentScanFailed = currentScan?.scan_status === "failed";
  const scoreDelta =
    currentScan && previousScan ? currentScan.performance_score - previousScan.performance_score : null;
  const healthScore = data?.health_score ?? null;
  const seoAudit = data?.seo_audit ?? null;
  const sslCheck = data?.ssl_check ?? null;
  const securityHeaders = data?.security_headers ?? null;
  const cruxData = data?.crux_data ?? null;
  const brokenLinks = data?.broken_links ?? null;
  const uptimeSummary = buildUptimeSummary(data?.uptime_checks ?? []);
  const competitorEntries = latestCompetitorEntries(data?.competitor_scans ?? []);

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
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        eyebrow="Website detail"
        title={data.label}
        description={data.url}
        actions={
          <div className="grid w-full gap-3 sm:grid-cols-2 xl:w-auto xl:grid-cols-3">
            <Button variant="outline" onClick={runScan} disabled={isPending} className="h-11 w-full justify-center sm:h-12">
              <WandSparkles className="h-4 w-4" />
              Run scan
            </Button>
            <Button variant="outline" onClick={generateReport} disabled={isPending} className="h-11 w-full justify-center sm:h-12">
              <FileDown className="h-4 w-4" />
              Generate PDF
            </Button>
            <Button onClick={emailReport} disabled={isPending} className="h-11 w-full justify-center sm:h-12 sm:col-span-2 xl:col-span-1">
              <Mail className="h-4 w-4" />
              Email report
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Overall health</p>
            <div className="mt-4 flex items-end justify-between gap-4">
              <div>
                <p className="font-display text-4xl font-semibold">{healthScore?.overall ?? "--"}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Weighted across performance, SEO, security, uptime, and accessibility.
                </p>
              </div>
              {healthScore ? (
                <Badge variant={healthScore.overall >= 85 ? "success" : healthScore.overall >= 60 ? "warning" : "danger"}>
                  {healthScore.overall >= 85 ? "Strong" : healthScore.overall >= 60 ? "Watch" : "Needs work"}
                </Badge>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">SSL</p>
            <div className="mt-4 flex items-end justify-between gap-4">
              <div>
                <p className="font-display text-2xl font-semibold">
                  {sslCheck?.days_until_expiry !== null && sslCheck?.days_until_expiry !== undefined
                    ? `${sslCheck.days_until_expiry} days`
                    : "Unknown"}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {sslCheck?.expiry_date
                    ? `Expires ${new Date(sslCheck.expiry_date).toLocaleDateString()}`
                    : "No SSL expiry date recorded yet."}
                </p>
              </div>
              {sslCheck ? (
                <Badge variant={gradeVariant(sslCheck.grade)}>
                  {sslCheck.grade === "green"
                    ? "Healthy"
                    : sslCheck.grade === "orange"
                      ? "Renew soon"
                      : sslCheck.grade === "red"
                        ? "Urgent"
                        : "Critical"}
                </Badge>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Security headers</p>
            <div className="mt-4 flex items-end justify-between gap-4">
              <div>
                <p className="font-display text-4xl font-semibold">{securityHeaders?.grade ?? "--"}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {securityHeaders ? "Grade based on six key browser security headers." : "Header audit not available yet."}
                </p>
              </div>
              {securityHeaders ? <Badge variant={gradeVariant(securityHeaders.grade)}>{securityHeaders.grade}</Badge> : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">30-day uptime</p>
            <div className="mt-4 flex items-end justify-between gap-4">
              <div>
                <p className="font-display text-4xl font-semibold">{uptimeSummary.percentage}%</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {uptimeSummary.averageResponseMs !== null
                    ? `Average response ${uptimeSummary.averageResponseMs} ms`
                    : "Waiting for enough uptime samples."}
                </p>
              </div>
              <Badge variant={uptimeSummary.percentage >= 99 ? "success" : uptimeSummary.percentage >= 95 ? "warning" : "danger"}>
                {uptimeSummary.incidents.length} incidents
              </Badge>
            </div>
          </CardContent>
        </Card>
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
                    <WandSparkles className="mr-2 h-4 w-4" />
                    Retry scan
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
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
                <Card className="relative overflow-hidden border-white/8 bg-[linear-gradient(180deg,rgba(30,41,59,0.94),rgba(15,23,42,0.92))] shadow-[0_28px_90px_-44px_rgba(15,23,42,0.9),0_0_0_1px_rgba(96,165,250,0.06)]">
                  <div className="pointer-events-none absolute inset-px rounded-[1.45rem] border border-white/6" />
                  <div className="pointer-events-none absolute left-0 top-0 h-28 w-48 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.12),transparent_72%)] blur-2xl" />
                  <CardHeader className="relative pb-3 sm:pb-5">
                    <CardTitle>Score trend (last 30 days)</CardTitle>
                    <CardDescription>Performance, SEO, and accessibility movement across recent scans.</CardDescription>
                  </CardHeader>
                  <CardContent className="relative px-3 pb-3 pt-0 sm:px-6 sm:pb-6">
                    <ScoreTrendChart scans={data.scans.slice(0, 30)} />
                  </CardContent>
                </Card>
                <Card className="relative overflow-hidden border-white/8 bg-[linear-gradient(180deg,rgba(30,41,59,0.94),rgba(15,23,42,0.92))] shadow-[0_28px_90px_-44px_rgba(15,23,42,0.9),0_0_0_1px_rgba(96,165,250,0.06)]">
                  <div className="pointer-events-none absolute inset-px rounded-[1.45rem] border border-white/6" />
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
                <Card>
                  <CardHeader className="pb-3 sm:pb-6">
                    <CardTitle>Core Web Vitals</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-3 px-4 pb-4 pt-0 sm:px-6 sm:pb-6 md:grid-cols-2">
                    {[
                      ["Largest Contentful Paint", `${Math.round(currentScan.lcp ?? 0)} ms`],
                      ["First Input Delay", `${Math.round(currentScan.fid ?? 0)} ms`],
                      ["Cumulative Layout Shift", `${currentScan.cls ?? 0}`],
                      ["Total Blocking Time", `${Math.round(currentScan.tbt ?? 0)} ms`]
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-2xl border border-border bg-background p-3 sm:p-4">
                        <p className="text-[10px] uppercase leading-5 tracking-[0.16em] text-muted-foreground sm:text-xs sm:tracking-[0.18em]">
                          {label}
                        </p>
                        <p className="mt-1.5 font-display text-xl font-semibold sm:mt-2 sm:text-2xl">{value}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3 sm:pb-6">
                    <CardTitle>Accessibility violations</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 px-4 pb-4 pt-0 sm:px-6 sm:pb-6">
                    {accessibilityViolations.length ? (
                      accessibilityViolations.slice(0, 8).map((violation, index) => (
                        <div key={index} className="rounded-2xl border border-border bg-background p-3 sm:p-4">
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
                      <p className="rounded-2xl border border-border bg-background p-3 text-sm text-muted-foreground sm:p-4">
                        No accessibility violations recorded on the latest scan.
                      </p>
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
                    <div className="rounded-3xl border border-border bg-background p-4 sm:p-5">
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                        <div className="flex flex-wrap gap-2">
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
                      <TabsList className="grid h-auto w-full grid-cols-3">
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

                                <div className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">
                                  <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground">
                                      What&apos;s happening
                                    </p>
                                    <p>{issue.whats_happening}</p>
                                  </div>
                                  <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground">
                                      Why it matters
                                    </p>
                                    <p>{issue.business_impact}</p>
                                  </div>
                                  <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground">
                                      How to fix
                                    </p>
                                    <p>{issue.how_to_fix}</p>
                                  </div>
                                </div>

                                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                                  <span>⏱️ {issue.time_estimate}</span>
                                  <span>
                                    {difficultyStars(issue.difficulty)} {issue.difficulty}
                                  </span>
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
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
                                      ⚡ Quick Win
                                    </p>
                                    <p className="mt-1 text-lg font-semibold leading-tight">{recommendation.title}</p>
                                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{recommendation.description}</p>
                                    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                                      <span>
                                        {difficultyStars(recommendation.difficulty)} {recommendation.difficulty}
                                      </span>
                                      <span>⏱️ {recommendation.time_estimate}</span>
                                      <Badge variant={badgeVariantForSeverity(recommendation.priority)} className="self-start">
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

          <Card>
            <CardHeader className="gap-4 pb-3 sm:pb-6">
              <div className="space-y-1">
                <CardTitle>Website health signals</CardTitle>
                <p className="text-sm text-muted-foreground">
                  On-page SEO, link health, security, uptime, real user data, and competitor tracking in one place.
                </p>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0 sm:px-6 sm:pb-6">
              <Tabs defaultValue="seo-audit" className="w-full">
                <TabsList className="grid h-auto w-full grid-cols-2 lg:grid-cols-5">
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
                            value: `${seoAudit.title_tag.status} • ${seoAudit.title_tag.length ?? 0} chars`,
                            pass: seoAudit.title_tag.exists
                          },
                          {
                            label: "Meta description",
                            value: `${seoAudit.meta_description.status} • ${seoAudit.meta_description.length ?? 0} chars`,
                            pass: seoAudit.meta_description.exists
                          },
                          {
                            label: "Headings",
                            value: `${seoAudit.headings.status} • H1 ${seoAudit.headings.h1_count}, H2 ${seoAudit.headings.h2_count}, H3 ${seoAudit.headings.h3_count}`,
                            pass: seoAudit.headings.status === "Good"
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
                            value: seoAudit.schema_present
                              ? seoAudit.schema_types.join(", ") || "Detected"
                              : "Missing",
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
                          <p className="text-sm font-semibold">Images missing alt text</p>
                          <p className="mt-2 font-display text-3xl font-semibold">{seoAudit.images_missing_alt}</p>
                          <div className="mt-4 space-y-2">
                            {seoAudit.images_missing_alt_urls.length ? (
                              seoAudit.images_missing_alt_urls.map((url) => (
                                <p key={url} className="break-all text-sm leading-6 text-muted-foreground">
                                  {url}
                                </p>
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
                      SEO audit data will appear here after the next completed scan.
                    </p>
                  )}
                </TabsContent>

                <TabsContent value="link-health" className="mt-5">
                  <LinkHealthPanel brokenLinks={brokenLinks} websiteUrl={data.url} />
                </TabsContent>

                <TabsContent value="security" className="mt-5">
                  <div className="grid gap-4 xl:grid-cols-2">
                    <div className="rounded-2xl border border-border bg-background p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">SSL certificate</p>
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">
                            {sslCheck
                              ? `${sslCheck.issuer ?? "Unknown issuer"} • ${sslCheck.days_until_expiry ?? "Unknown"} day(s) remaining`
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
                            onChange={(event) => setCompetitorInput(event.target.value)}
                            placeholder="https://competitor-one.com&#10;https://competitor-two.com"
                          />
                        </div>
                        <Button onClick={saveCompetitors} disabled={isPending} className="shrink-0">
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
                                  <p className="break-all text-sm font-semibold">{competitor.competitor_url}</p>
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
          <WebsiteHealthSignalsEmptyStateCard
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
          />
        </>
      )}
    </div>
  );
}
