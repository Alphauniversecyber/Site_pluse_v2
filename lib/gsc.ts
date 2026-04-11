import "server-only";

import type { GscDashboardData, GscDailyPoint, GscSitemapRecord, GscTopQuery } from "@/types";

class GoogleApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function hashSeed(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function createRng(seed: string) {
  let state = hashSeed(seed) || 1;

  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let result = Math.imul(state ^ (state >>> 15), 1 | state);
    result ^= result + Math.imul(result ^ (result >>> 7), 61 | result);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function shiftDays(date: Date, amount: number) {
  const value = new Date(date);
  value.setUTCDate(value.getUTCDate() + amount);
  return value;
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatLabel(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric"
  }).format(new Date(`${date}T00:00:00.000Z`));
}

function hostFromUrl(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return url.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/.*$/, "");
  }
}

function googleHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json"
  };
}

async function parseGoogleResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => ({}))) as T & {
    error?: {
      message?: string;
    };
  };

  if (!response.ok) {
    throw new GoogleApiError(
      response.status,
      payload.error?.message ?? `Google API request failed with status ${response.status}.`
    );
  }

  return payload;
}

function percentDelta(current: number, previous: number) {
  if (!previous) {
    return 0;
  }

  return Number((((current - previous) / previous) * 100).toFixed(1));
}

function improvementDelta(current: number, previous: number) {
  if (!previous) {
    return 0;
  }

  return Number((((previous - current) / previous) * 100).toFixed(1));
}

function mapSeries(
  rows: Array<{ keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number }> | undefined,
  startDate: string,
  endDate: string
) {
  const map = new Map(
    (rows ?? []).map((row) => [
      row.keys?.[0] ?? "",
      {
        clicks: Math.round(row.clicks ?? 0),
        impressions: Math.round(row.impressions ?? 0),
        ctr: Number(((row.ctr ?? 0) * 100).toFixed(2)),
        position: Number((row.position ?? 0).toFixed(1))
      }
    ])
  );
  const series: GscDailyPoint[] = [];
  const cursor = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);

  while (cursor <= end) {
    const date = formatDate(cursor);
    const row = map.get(date);

    series.push({
      date,
      label: formatLabel(date),
      clicks: row?.clicks ?? 0,
      impressions: row?.impressions ?? 0,
      ctr: row?.ctr ?? 0,
      position: row?.position ?? 0
    });

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return series;
}

function summarizeDaily(points: GscDailyPoint[]) {
  const clicks = points.reduce((sum, point) => sum + point.clicks, 0);
  const impressions = points.reduce((sum, point) => sum + point.impressions, 0);
  const weightedPosition =
    impressions > 0
      ? points.reduce((sum, point) => sum + point.position * point.impressions, 0) / impressions
      : 0;

  return {
    clicks,
    impressions,
    ctr: impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(2)) : 0,
    avgPosition: Number(weightedPosition.toFixed(1))
  };
}

function normalizeOrigin(url: string) {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}/`;
  } catch {
    return `https://${hostFromUrl(url)}/`;
  }
}

function matchesProperty(property: string, websiteUrl: string) {
  const websiteHost = hostFromUrl(websiteUrl);

  if (property.startsWith("sc-domain:")) {
    const domain = property.replace("sc-domain:", "").replace(/^www\./i, "");
    return websiteHost === domain || websiteHost.endsWith(`.${domain}`);
  }

  return hostFromUrl(property) === websiteHost;
}

async function querySearchAnalytics(input: {
  accessToken: string;
  property: string;
  startDate: string;
  endDate: string;
  dimensions: string[];
  rowLimit?: number;
}) {
  const response = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(
      input.property
    )}/searchAnalytics/query`,
    {
      method: "POST",
      headers: googleHeaders(input.accessToken),
      body: JSON.stringify({
        startDate: input.startDate,
        endDate: input.endDate,
        dimensions: input.dimensions,
        rowLimit: input.rowLimit ?? 5000
      }),
      cache: "no-store"
    }
  );

  return parseGoogleResponse<{
    rows?: Array<{
      keys?: string[];
      clicks?: number;
      impressions?: number;
      ctr?: number;
      position?: number;
    }>;
  }>(response);
}

export function isGoogleAuthError(error: unknown) {
  return error instanceof GoogleApiError && (error.status === 401 || error.status === 403);
}

export async function pickBestGscProperty(accessToken: string, websiteUrl: string) {
  const response = await fetch("https://www.googleapis.com/webmasters/v3/sites", {
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    cache: "no-store"
  });
  const payload = await parseGoogleResponse<{
    siteEntry?: Array<{
      siteUrl: string;
      permissionLevel?: string;
    }>;
  }>(response);

  const properties = payload.siteEntry?.map((item) => item.siteUrl).filter(Boolean) ?? [];
  const exactOrigin = normalizeOrigin(websiteUrl);

  return (
    properties.find((property) => property === exactOrigin) ??
    properties.find((property) => matchesProperty(property, websiteUrl)) ??
    properties[0] ??
    exactOrigin
  );
}

export async function fetchGscDashboardData(input: {
  accessToken: string;
  property: string;
}) {
  const endDate = shiftDays(new Date(), -1);
  const currentStart = shiftDays(endDate, -27);
  const previousEnd = shiftDays(currentStart, -1);
  const previousStart = shiftDays(previousEnd, -27);

  const [dailyResponse, previousResponse, topQueriesResponse, sitemapResponse] = await Promise.all([
    querySearchAnalytics({
      accessToken: input.accessToken,
      property: input.property,
      startDate: formatDate(currentStart),
      endDate: formatDate(endDate),
      dimensions: ["date"]
    }),
    querySearchAnalytics({
      accessToken: input.accessToken,
      property: input.property,
      startDate: formatDate(previousStart),
      endDate: formatDate(previousEnd),
      dimensions: ["date"]
    }),
    querySearchAnalytics({
      accessToken: input.accessToken,
      property: input.property,
      startDate: formatDate(currentStart),
      endDate: formatDate(endDate),
      dimensions: ["query"],
      rowLimit: 8
    }),
    fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(input.property)}/sitemaps`,
      {
        headers: {
          Authorization: `Bearer ${input.accessToken}`
        },
        cache: "no-store"
      }
    ).then((response) =>
      parseGoogleResponse<{
        sitemap?: Array<{
          path: string;
          warnings?: string | number;
          errors?: string | number;
          contents?: Array<{
            submitted?: string | number;
            indexed?: string | number;
          }>;
        }>;
      }>(response)
    )
  ]);

  const daily = mapSeries(dailyResponse.rows, formatDate(currentStart), formatDate(endDate));
  const previousDaily = mapSeries(previousResponse.rows, formatDate(previousStart), formatDate(previousEnd));
  const currentSummary = summarizeDaily(daily);
  const previousSummary = summarizeDaily(previousDaily);
  const sitemaps: GscSitemapRecord[] = (sitemapResponse.sitemap ?? []).map((item) => {
    const submitted = (item.contents ?? []).reduce(
      (sum, content) => sum + Number(content.submitted ?? 0),
      0
    );
    const errors = Number(item.errors ?? 0);
    const warnings = Number(item.warnings ?? 0);

    return {
      path: item.path,
      submitted,
      errors,
      warnings,
      healthy: errors === 0 && warnings === 0
    };
  });
  const sitemapSubmitted = sitemaps.reduce((sum, item) => sum + item.submitted, 0);
  const indexedPages = Math.max(
    0,
    (sitemapResponse.sitemap ?? []).reduce((sum, item) => {
      const indexed = (item.contents ?? []).reduce(
        (total, content) => total + Number(content.indexed ?? 0),
        0
      );

      return sum + (indexed || 0);
    }, 0) || sitemapSubmitted
  );
  const topQueries: GscTopQuery[] = (topQueriesResponse.rows ?? []).map((row) => ({
    query: row.keys?.[0] ?? "Unknown query",
    clicks: Math.round(row.clicks ?? 0),
    impressions: Math.round(row.impressions ?? 0),
    ctr: Number(((row.ctr ?? 0) * 100).toFixed(2)),
    position: Number((row.position ?? 0).toFixed(1))
  }));

  return {
    connected: true,
    source: "live" as const,
    property: input.property,
    lastSyncedAt: new Date().toISOString(),
    summary: {
      clicks: currentSummary.clicks,
      impressions: currentSummary.impressions,
      avgPosition: currentSummary.avgPosition,
      indexedPages,
      sitemapSubmitted,
      ctr: currentSummary.ctr
    },
    comparison: {
      clicks: percentDelta(currentSummary.clicks, previousSummary.clicks),
      impressions: percentDelta(currentSummary.impressions, previousSummary.impressions),
      avgPosition: improvementDelta(currentSummary.avgPosition, previousSummary.avgPosition),
      indexedPages: 0
    },
    daily,
    topQueries,
    sitemaps
  } satisfies GscDashboardData;
}

export function buildMockGscData(input: {
  seed: string;
  websiteUrl: string;
  connected: boolean;
  property?: string | null;
}) {
  const rng = createRng(`${input.seed}:gsc`);
  const endDate = shiftDays(new Date(), -1);
  const startDate = shiftDays(endDate, -55);
  const allDays: GscDailyPoint[] = [];
  const brand = hostFromUrl(input.websiteUrl).split(".")[0].replace(/[-_]/g, " ");
  const clicksBase = 112 + rng() * 34;
  const impressionsBase = 2950 + rng() * 850;
  const positionBase = 21.5 - rng() * 1.8;

  for (let index = 0; index < 56; index += 1) {
    const date = shiftDays(startDate, index);
    const weeklyWave = Math.sin(index / 3.4) * 14;
    const trend = index * 0.95;
    const clicks = clamp(Math.round(clicksBase + weeklyWave + trend + (rng() - 0.5) * 16), 80, 205);
    const impressions = clamp(
      Math.round(impressionsBase + weeklyWave * 26 + trend * 20 + (rng() - 0.5) * 360),
      2000,
      5000
    );
    const position = Number(
      clamp(positionBase - index * 0.11 + Math.sin(index / 5.5) * 0.6 + (rng() - 0.5) * 0.5, 12, 22).toFixed(1)
    );

    allDays.push({
      date: formatDate(date),
      label: formatLabel(formatDate(date)),
      clicks,
      impressions,
      ctr: Number(((clicks / impressions) * 100).toFixed(2)),
      position
    });
  }

  const previousDaily = allDays.slice(0, 28);
  const daily = allDays.slice(28);
  const currentSummary = summarizeDaily(daily);
  const previousSummary = summarizeDaily(previousDaily);
  const indexedPages = Math.round(62 + rng() * 78);
  const sitemapSubmitted = indexedPages + Math.round(rng() * 12);
  const sitemaps: GscSitemapRecord[] = [
    {
      path: `${normalizeOrigin(input.websiteUrl)}sitemap.xml`,
      submitted: Math.round(indexedPages * 0.72),
      errors: 0,
      warnings: 0,
      healthy: true
    },
    (() => {
      const errors = rng() > 0.72 ? 1 : 0;
      const warnings = rng() > 0.55 ? 1 : 0;

      return {
      path: `${normalizeOrigin(input.websiteUrl)}post-sitemap.xml`,
      submitted: Math.round(indexedPages * 0.28),
      errors,
      warnings,
      healthy: errors === 0 && warnings === 0
    };
    })()
  ];
  const querySeeds = [
    brand,
    `${brand} services`,
    `${brand} pricing`,
    `${brand} reviews`,
    `${brand} contact`,
    `${brand} near me`,
    `${brand} seo audit`,
    `${brand} website performance`
  ];
  const topQueries: GscTopQuery[] = querySeeds.map((query, index) => {
    const clicks = clamp(Math.round(14 + rng() * 28 + (8 - index) * 4), 8, 56);
    const impressions = clamp(Math.round(clicks * (18 + rng() * 24)), 180, 2200);
    return {
      query,
      clicks,
      impressions,
      ctr: Number(((clicks / impressions) * 100).toFixed(2)),
      position: Number(clamp(6 + index * 1.3 + rng() * 2.2, 4, 24).toFixed(1))
    };
  });

  return {
    connected: input.connected,
    source: "mock" as const,
    property: input.property ?? null,
    lastSyncedAt: null,
    summary: {
      clicks: currentSummary.clicks,
      impressions: currentSummary.impressions,
      avgPosition: currentSummary.avgPosition,
      indexedPages,
      sitemapSubmitted,
      ctr: currentSummary.ctr
    },
    comparison: {
      clicks: percentDelta(currentSummary.clicks, previousSummary.clicks),
      impressions: percentDelta(currentSummary.impressions, previousSummary.impressions),
      avgPosition: improvementDelta(currentSummary.avgPosition, previousSummary.avgPosition),
      indexedPages: Number((((indexedPages - (indexedPages - 4)) / Math.max(indexedPages - 4, 1)) * 100).toFixed(1))
    },
    daily,
    topQueries,
    sitemaps
  } satisfies GscDashboardData;
}
