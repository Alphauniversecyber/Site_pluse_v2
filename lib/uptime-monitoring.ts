import "server-only";

import type { ScanResult, UptimeCheckRecord, UserProfile, Website } from "@/types";
import { createCronExecutionGuard, getCronBatchLimit } from "@/lib/cron";
import { buildEmailDedupeKey } from "@/lib/email-utils";
import { trySendCriticalAlertEmail } from "@/lib/resend";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const UPTIME_CACHE_HOURS = 24;
const UPTIMEROBOT_ENDPOINT = "https://api.uptimerobot.com/v2/getMonitors";
const VERCEL_UPTIME_TIMEOUT_MS = parsePositiveInt(process.env.VERCEL_UPTIME_TIMEOUT_MS, 15_000);
const VERCEL_UPTIME_FETCH_ATTEMPTS = parsePositiveInt(process.env.VERCEL_UPTIME_FETCH_ATTEMPTS, 2);
const VERCEL_UPTIME_RETRY_DELAY_MS = parsePositiveInt(process.env.VERCEL_UPTIME_RETRY_DELAY_MS, 1_500);

function parsePositiveInt(raw: string | undefined, fallback: number) {
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isFresh(timestamp: string, hours: number) {
  return Date.now() - new Date(timestamp).getTime() < hours * 60 * 60 * 1000;
}

function normalizeComparableUrl(value: string) {
  const parsed = new URL(value);
  parsed.hash = "";
  if (parsed.pathname.endsWith("/") && parsed.pathname !== "/") {
    parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  }
  return parsed.toString();
}

function isTransientFetchError(message: string) {
  return /fetch failed|timeout|timed out|network|socket|econn|enotfound|eai_again|tls/i.test(message);
}

async function createUptimeAlert(input: {
  profile: UserProfile;
  website: Website;
  status: "up" | "down";
  source: "vercel" | "uptimerobot";
  reason: string;
}) {
  if (input.status !== "down") {
    return;
  }

  const admin = createSupabaseAdminClient();
  const { data: recentAlerts } = await admin
    .from("notifications")
    .select("created_at, metadata")
    .eq("user_id", input.profile.id)
    .eq("website_id", input.website.id)
    .eq("type", "uptime_alert")
    .order("created_at", { ascending: false })
    .limit(10);

  const alreadyAlerted = (recentAlerts ?? []).some((item) => {
    const metadata = (item.metadata ?? {}) as Record<string, unknown>;
    const createdAt = typeof item.created_at === "string" ? item.created_at : null;
    return (
      metadata.source === input.source &&
      metadata.status === "down" &&
      createdAt !== null &&
      isFresh(createdAt, 24)
    );
  });

  if (alreadyAlerted) {
    return;
  }

  await admin.from("notifications").insert({
    user_id: input.profile.id,
    website_id: input.website.id,
    type: "uptime_alert",
    title: `${input.website.label} appears offline`,
    body: input.reason,
    severity: "high",
    metadata: {
      source: input.source,
      status: input.status
    }
  });

  if (input.profile.email_notifications_enabled) {
    const syntheticScan = {
      id: `uptime-${input.source}-${Date.now()}`,
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
      templateId: "alert_uptime",
      dedupeKey: buildEmailDedupeKey(
        "alert",
        "uptime",
        input.website.id,
        input.source,
        new Date().toISOString().slice(0, 10)
      ),
      to: input.profile.email,
      website: input.website,
      scan: syntheticScan,
      reason: input.reason,
      triggeredAt: syntheticScan.scanned_at
    });
  }
}

export async function ensureDailyVercelUptimeCheck(input: {
  websiteId: string;
  url: string;
  profile?: UserProfile | null;
  website?: Website | null;
  force?: boolean;
}) {
  const admin = createSupabaseAdminClient();
  const { data: latest } = await admin
    .from("uptime_checks")
    .select("*")
    .eq("website_id", input.websiteId)
    .eq("source", "vercel")
    .order("checked_at", { ascending: false })
    .limit(1)
    .maybeSingle<UptimeCheckRecord>();

  if (!input.force && latest?.checked_at && isFresh(latest.checked_at, UPTIME_CACHE_HOURS)) {
    return latest;
  }

  const startedAt = Date.now();
  let status: UptimeCheckRecord["status"] = "down";
  let responseTimeMs: number | null = null;
  let incidentReason: string | null = null;
  let rawPayload: Record<string, unknown> = {};
  let shouldAlert = true;

  let lastErrorMessage: string | null = null;

  for (let attempt = 1; attempt <= VERCEL_UPTIME_FETCH_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(input.url, {
        method: "GET",
        cache: "no-store",
        redirect: "follow",
        signal: AbortSignal.timeout(VERCEL_UPTIME_TIMEOUT_MS),
        headers: {
          "user-agent": "SitePulse Uptime Check/1.0"
        }
      });

      responseTimeMs = Date.now() - startedAt;
      const classification = classifyVercelHealthCheck(response);
      status = classification.status;
      incidentReason = classification.incidentReason;
      rawPayload = {
        attempt,
        attemptsConfigured: VERCEL_UPTIME_FETCH_ATTEMPTS,
        status: response.status
      };
      lastErrorMessage = null;
      break;
    } catch (error) {
      lastErrorMessage = error instanceof Error ? error.message : "Health check failed.";
      rawPayload = {
        attempt,
        attemptsConfigured: VERCEL_UPTIME_FETCH_ATTEMPTS,
        fetchError: lastErrorMessage
      };

      if (attempt < VERCEL_UPTIME_FETCH_ATTEMPTS && isTransientFetchError(lastErrorMessage)) {
        await sleep(VERCEL_UPTIME_RETRY_DELAY_MS * attempt);
        continue;
      }

      responseTimeMs = Date.now() - startedAt;
      status = "down";
      incidentReason = lastErrorMessage;
      shouldAlert = !isTransientFetchError(lastErrorMessage);
      break;
    }
  }

  if (lastErrorMessage && isTransientFetchError(lastErrorMessage) && latest?.status === "up") {
    status = "up";
    incidentReason = null;
    shouldAlert = false;
    rawPayload = {
      ...rawPayload,
      transientFailureIgnored: true
    };
  }

  const { data, error } = await admin
    .from("uptime_checks")
    .insert({
      website_id: input.websiteId,
      checked_at: new Date().toISOString(),
      status,
      response_time_ms: responseTimeMs,
      source: "vercel",
      incident_reason: incidentReason,
      raw_payload: rawPayload
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to store uptime check.");
  }

  if (status === "down" && shouldAlert && input.profile && input.website) {
    await createUptimeAlert({
      profile: input.profile,
      website: input.website,
      status,
      source: "vercel",
      reason: incidentReason ?? `${input.website.label} did not respond to the daily uptime check.`
    });
  }

  return data as UptimeCheckRecord;
}

type UptimeRobotMonitor = {
  id: number;
  friendly_name?: string;
  url?: string;
  status?: number;
  all_time_uptime_ratio?: string;
  custom_uptime_ratio?: string;
  average_response_time?: string;
  response_times?: Array<{
    value?: number | string;
  }>;
};

type UptimeRobotResponse = {
  stat?: "ok" | "fail";
  monitors?: UptimeRobotMonitor[];
  error?: {
    message?: string;
  };
};

function matchMonitor(monitors: UptimeRobotMonitor[], websiteUrl: string) {
  const comparableWebsiteUrl = normalizeComparableUrl(websiteUrl);
  const websiteOrigin = new URL(websiteUrl).origin;

  return (
    monitors.find((monitor) => monitor.url && normalizeComparableUrl(monitor.url) === comparableWebsiteUrl) ??
    monitors.find((monitor) => monitor.url && new URL(monitor.url).origin === websiteOrigin) ??
    null
  );
}

function monitorStatus(status: number | undefined): UptimeCheckRecord["status"] {
  return status === 2 ? "up" : "down";
}

function monitorResponseTime(monitor: UptimeRobotMonitor) {
  const directAverage = Number(monitor.average_response_time);
  if (!Number.isNaN(directAverage) && directAverage > 0) {
    return Math.round(directAverage);
  }

  const latestResponse = Number(monitor.response_times?.[0]?.value);
  return !Number.isNaN(latestResponse) && latestResponse > 0 ? Math.round(latestResponse) : null;
}

function classifyVercelHealthCheck(response: Response) {
  if (response.status >= 500) {
    return {
      status: "down" as const,
      incidentReason: `Health check returned HTTP ${response.status}.`
    };
  }

  return {
    status: "up" as const,
    incidentReason: null
  };
}

export async function syncUptimeRobotForUser(input: {
  profile: UserProfile;
  websites: Website[];
}) {
  if (process.env.UPTIMEROBOT_ENABLED === "false") {
    return [];
  }

  if (!input.profile.uptimerobot_api_key?.trim()) {
    return [];
  }

  const response = await fetch(UPTIMEROBOT_ENDPOINT, {
    method: "POST",
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      api_key: input.profile.uptimerobot_api_key,
      format: "json",
      custom_uptime_ratios: "30",
      response_times_average: "60"
    }).toString()
  });

  if (!response.ok) {
    throw new Error(`UptimeRobot sync failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as UptimeRobotResponse;
  if (payload.stat !== "ok") {
    throw new Error(payload.error?.message ?? "UptimeRobot sync failed.");
  }

  const monitors = payload.monitors ?? [];
  const admin = createSupabaseAdminClient();
  const inserted: UptimeCheckRecord[] = [];

  for (const website of input.websites) {
    const monitor = matchMonitor(monitors, website.url);
    if (!monitor) {
      continue;
    }

    const status = monitorStatus(monitor.status);
    const reason = status === "down" ? "UptimeRobot reports this monitor as down." : null;
    const { data, error } = await admin
      .from("uptime_checks")
      .insert({
        website_id: website.id,
        checked_at: new Date().toISOString(),
        status,
        response_time_ms: monitorResponseTime(monitor),
        source: "uptimerobot",
        incident_reason: reason,
        raw_payload: monitor
      })
      .select("*")
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? "Unable to store UptimeRobot check.");
    }

    inserted.push(data as UptimeCheckRecord);

    if (status === "down") {
      await createUptimeAlert({
        profile: input.profile,
        website,
        status,
        source: "uptimerobot",
        reason: `${website.label} appears down in UptimeRobot.`
      });
    }
  }

  return inserted;
}

export async function processDailyUptimeChecks(limit = getCronBatchLimit("UPTIME_CRON_LIMIT", 50)) {
  const admin = createSupabaseAdminClient();
  const guard = createCronExecutionGuard("process-uptime", 240_000);
  const { data: websites, error } = await admin
    .from("websites")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  const processed: string[] = [];

  for (const row of websites ?? []) {
    const website = row as Website;
    if (guard.shouldStop({ processedCount: processed.length, websiteId: website.id })) {
      break;
    }

    const { data: profile } = await admin
      .from("users")
      .select("*")
      .eq("id", website.user_id)
      .maybeSingle<UserProfile>();

    await ensureDailyVercelUptimeCheck({
      websiteId: website.id,
      url: website.url,
      profile,
      website
    });
    processed.push(website.id);
  }

  return processed;
}

export async function processUptimeRobotSync(limit = getCronBatchLimit("UPTIMEROBOT_SYNC_LIMIT", 20)) {
  const admin = createSupabaseAdminClient();
  const guard = createCronExecutionGuard("sync-uptimerobot", 240_000);
  const { data: profiles, error } = await admin
    .from("users")
    .select("*")
    .not("uptimerobot_api_key", "is", null)
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  const synced: string[] = [];

  for (const profile of (profiles ?? []) as UserProfile[]) {
    if (guard.shouldStop({ syncedCount: synced.length, userId: profile.id })) {
      break;
    }

    if (!profile.uptimerobot_api_key) {
      continue;
    }

    const { data: websites } = await admin
      .from("websites")
      .select("*")
      .eq("user_id", profile.id)
      .eq("is_active", true);

    await syncUptimeRobotForUser({
      profile,
      websites: (websites ?? []) as Website[]
    });

    synced.push(profile.id);
  }

  return synced;
}
