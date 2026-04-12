import "server-only";

import type { ScanResult, UserProfile, Website } from "@/types";
import { createCronExecutionGuard, getCronBatchLimit } from "@/lib/cron";
import { runPageSpeedScan } from "@/lib/pagespeed";
import { trySendCriticalAlertEmail } from "@/lib/resend";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const COMPETITOR_CACHE_HOURS = 24;

function isFresh(timestamp: string, hours: number) {
  return Date.now() - new Date(timestamp).getTime() < hours * 60 * 60 * 1000;
}

function overallScore(input: {
  performance: number;
  seo: number;
  accessibility: number;
  bestPractices: number;
}) {
  return Math.round((input.performance + input.seo + input.accessibility + input.bestPractices) / 4);
}

async function createCompetitorAlert(input: {
  profile: UserProfile;
  website: Website;
  reason: string;
  metadata: Record<string, unknown>;
}) {
  const admin = createSupabaseAdminClient();
  const { data: recentAlerts } = await admin
    .from("notifications")
    .select("created_at, metadata")
    .eq("user_id", input.profile.id)
    .eq("website_id", input.website.id)
    .eq("type", "competitor_alert")
    .order("created_at", { ascending: false })
    .limit(10);

  const alreadyAlerted = (recentAlerts ?? []).some((item) => {
    const createdAt = typeof item.created_at === "string" ? item.created_at : null;
    return (
      createdAt !== null &&
      isFresh(createdAt, 24) &&
      JSON.stringify(item.metadata ?? {}) === JSON.stringify(input.metadata)
    );
  });

  if (alreadyAlerted) {
    return;
  }

  await admin.from("notifications").insert({
    user_id: input.profile.id,
    website_id: input.website.id,
    type: "competitor_alert",
    title: `Competitor movement on ${input.website.label}`,
    body: input.reason,
    severity: "medium",
    metadata: input.metadata
  });

  if (input.profile.email_notifications_enabled) {
    const syntheticScan = {
      id: `competitor-${Date.now()}`,
      website_id: input.website.id,
      performance_score: 0,
      seo_score: 0,
      accessibility_score: 0,
      best_practices_score: 0,
      lcp: null,
      fid: null,
      cls: null,
      tbt: null,
      issues: [],
      recommendations: [],
      raw_data: {},
      scanned_at: new Date().toISOString()
    } as ScanResult;

    await trySendCriticalAlertEmail({
      to: input.profile.email,
      website: input.website,
      scan: syntheticScan,
      reason: input.reason
    });
  }
}

export async function runCompetitorScan(input: {
  website: Website;
  profile: UserProfile;
  competitorUrl: string;
}) {
  const admin = createSupabaseAdminClient();
  const { data: latest } = await admin
    .from("competitor_scans")
    .select("*")
    .eq("website_id", input.website.id)
    .eq("competitor_url", input.competitorUrl)
    .order("scanned_at", { ascending: false })
    .limit(1)
    .maybeSingle<{
      scanned_at: string;
      performance: number;
      seo: number;
      accessibility: number;
      best_practices: number;
      scan_status: "success" | "failed";
    }>();

  if (latest?.scanned_at && isFresh(latest.scanned_at, COMPETITOR_CACHE_HOURS)) {
    return latest;
  }

  try {
    const scan = await runPageSpeedScan(input.competitorUrl);
    const payload = {
      website_id: input.website.id,
      competitor_url: input.competitorUrl,
      performance: scan.performance_score,
      seo: scan.seo_score,
      accessibility: scan.accessibility_score,
      best_practices: scan.best_practices_score,
      scan_status: "success" as const,
      error_message: scan.error_message ?? null,
      scanned_at: new Date().toISOString()
    };

    const { data, error } = await admin.from("competitor_scans").insert(payload).select("*").single();
    if (error || !data) {
      throw new Error(error?.message ?? "Unable to store competitor scan.");
    }

    const currentOverall = overallScore({
      performance: data.performance,
      seo: data.seo,
      accessibility: data.accessibility,
      bestPractices: data.best_practices
    });
    const previousOverall = latest
      ? overallScore({
          performance: latest.performance,
          seo: latest.seo,
          accessibility: latest.accessibility,
          bestPractices: latest.best_practices
        })
      : null;

    if (previousOverall !== null && currentOverall - previousOverall >= 10) {
      await createCompetitorAlert({
        profile: input.profile,
        website: input.website,
        reason: `A competitor improved by ${currentOverall - previousOverall} points on the latest check.`,
        metadata: {
          type: "competitor_improved",
          competitorUrl: input.competitorUrl,
          delta: currentOverall - previousOverall
        }
      });
    }

    const { data: ownScan } = await admin
      .from("scan_results")
      .select("*")
      .eq("website_id", input.website.id)
      .eq("scan_status", "success")
      .order("scanned_at", { ascending: false })
      .limit(1)
      .maybeSingle<ScanResult>();

    if (ownScan) {
      const ownOverall = overallScore({
        performance: ownScan.performance_score,
        seo: ownScan.seo_score,
        accessibility: ownScan.accessibility_score,
        bestPractices: ownScan.best_practices_score
      });

      if (currentOverall > ownOverall) {
        await createCompetitorAlert({
          profile: input.profile,
          website: input.website,
          reason: `A competitor is now scoring above your website overall.`,
          metadata: {
            type: "competitor_overtook",
            competitorUrl: input.competitorUrl,
            competitorScore: currentOverall,
            ownScore: ownOverall
          }
        });
      }
    }

    return data;
  } catch (error) {
    const payload = {
      website_id: input.website.id,
      competitor_url: input.competitorUrl,
      performance: 0,
      seo: 0,
      accessibility: 0,
      best_practices: 0,
      scan_status: "failed" as const,
      error_message: error instanceof Error ? error.message : "Competitor scan failed.",
      scanned_at: new Date().toISOString()
    };

    const { data, error: insertError } = await admin
      .from("competitor_scans")
      .insert(payload)
      .select("*")
      .single();

    if (insertError || !data) {
      throw new Error(insertError?.message ?? "Unable to store competitor scan failure.");
    }

    return data;
  }
}

export async function processCompetitorScans(limit = getCronBatchLimit("COMPETITOR_CRON_LIMIT", 20)) {
  const admin = createSupabaseAdminClient();
  const guard = createCronExecutionGuard("process-competitors", 45_000);
  const { data: websites, error } = await admin
    .from("websites")
    .select("*")
    .eq("is_active", true)
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  const processed: string[] = [];

  for (const website of (websites ?? []) as Website[]) {
    if (guard.shouldStop({ processedCount: processed.length, websiteId: website.id })) {
      break;
    }

    const competitors = Array.isArray(website.competitor_urls) ? website.competitor_urls.slice(0, 3) : [];
    if (!competitors.length) {
      continue;
    }

    const { data: profile } = await admin
      .from("users")
      .select("*")
      .eq("id", website.user_id)
      .maybeSingle<UserProfile>();

    if (!profile) {
      continue;
    }

    for (const competitorUrl of competitors) {
      if (guard.shouldStop({ processedCount: processed.length, websiteId: website.id, competitorUrl })) {
        return processed;
      }

      await runCompetitorScan({
        website,
        profile,
        competitorUrl
      });
    }

    processed.push(website.id);
  }

  return processed;
}
