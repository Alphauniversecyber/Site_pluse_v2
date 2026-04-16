import "server-only";

import type { DeviceBreakdownPoint, GaDashboardData, GaDailyPoint, GaTopPage } from "@/types";

class GoogleApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
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

function sameHost(left: string, right: string) {
  return hostFromUrl(left) === hostFromUrl(right);
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

function parseGaDate(value: string) {
  const normalized = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  return {
    date: normalized,
    label: formatLabel(normalized)
  };
}

function summarizeDaily(points: GaDailyPoint[]) {
  const sessions = points.reduce((sum, point) => sum + point.sessions, 0);
  const weightedBounce =
    sessions > 0
      ? points.reduce((sum, point) => sum + point.sessions * point.bounceRate, 0) / sessions
      : 0;
  const weightedSessionDuration =
    sessions > 0
      ? points.reduce((sum, point) => sum + point.sessions * point.averageSessionDuration, 0) / sessions
      : 0;

  return {
    sessions,
    bounceRate: Number(weightedBounce.toFixed(1)),
    averageSessionDuration: Number(weightedSessionDuration.toFixed(1))
  };
}

async function runGaReport(input: {
  accessToken: string;
  propertyId: string;
  startDate: string;
  endDate: string;
  dimensions: string[];
  metrics: string[];
  limit?: number;
  orderByMetric?: string;
}) {
  const response = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(
      input.propertyId
    )}:runReport`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        dateRanges: [
          {
            startDate: input.startDate,
            endDate: input.endDate
          }
        ],
        dimensions: input.dimensions.map((name) => ({ name })),
        metrics: input.metrics.map((name) => ({ name })),
        limit: input.limit ?? 1000,
        orderBys: input.orderByMetric
          ? [
              {
                metric: {
                  metricName: input.orderByMetric
                },
                desc: true
              }
            ]
          : undefined
      }),
      cache: "no-store"
    }
  );

  return parseGoogleResponse<{
    rows?: Array<{
      dimensionValues?: Array<{ value?: string }>;
      metricValues?: Array<{ value?: string }>;
    }>;
  }>(response);
}

export function isGoogleAuthError(error: unknown) {
  return error instanceof GoogleApiError && (error.status === 401 || error.status === 403);
}

export function buildEmptyGaData(input: {
  connected: boolean;
  propertyId?: string | null;
  source?: Exclude<GaDashboardData["source"], "live">;
}) {
  return {
    connected: input.connected,
    source: input.source ?? (input.connected ? "unavailable" : "disconnected"),
    propertyId: input.propertyId ?? null,
    lastSyncedAt: null,
    summary: {
      sessions: 0,
      bounceRate: 0,
      averageSessionDuration: 0
    },
    comparison: {
      sessions: 0,
      bounceRate: 0,
      averageSessionDuration: 0
    },
    daily: [],
    sparkline: [],
    topPages: [],
    devices: [],
    countries: []
  } satisfies GaDashboardData;
}

export async function pickBestGaPropertyId(accessToken: string, websiteUrl: string) {
  const response = await fetch(
    "https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
      cache: "no-store"
    }
  );
  const payload = await parseGoogleResponse<{
    accountSummaries?: Array<{
      propertySummaries?: Array<{
        property: string;
        displayName?: string;
      }>;
    }>;
  }>(response);

  const properties =
    payload.accountSummaries?.flatMap((summary) => summary.propertySummaries ?? []) ?? [];

  for (const property of properties) {
    const propertyId = property.property.replace("properties/", "");

    const streamsResponse = await fetch(
      `https://analyticsadmin.googleapis.com/v1beta/${property.property}/dataStreams?pageSize=50`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        },
        cache: "no-store"
      }
    );
    const streamsPayload = await parseGoogleResponse<{
      dataStreams?: Array<{
        type?: string;
        webStreamData?: {
          defaultUri?: string;
        };
      }>;
    }>(streamsResponse);

    const matchedStream = (streamsPayload.dataStreams ?? []).find(
      (stream) => stream.type === "WEB_DATA_STREAM" && stream.webStreamData?.defaultUri && sameHost(stream.webStreamData.defaultUri, websiteUrl)
    );

    if (matchedStream) {
      return propertyId;
    }
  }

  return null;
}

export async function fetchGaDashboardData(input: {
  accessToken: string;
  propertyId: string;
}) {
  const endDate = shiftDays(new Date(), -1);
  const currentStart = shiftDays(endDate, -27);
  const previousEnd = shiftDays(currentStart, -1);
  const previousStart = shiftDays(previousEnd, -27);

  const [dailyResponse, previousResponse, topPagesResponse, devicesResponse, countriesResponse] =
    await Promise.all([
      runGaReport({
        accessToken: input.accessToken,
        propertyId: input.propertyId,
        startDate: formatDate(currentStart),
        endDate: formatDate(endDate),
        dimensions: ["date"],
        metrics: ["sessions", "bounceRate", "averageSessionDuration"]
      }),
      runGaReport({
        accessToken: input.accessToken,
        propertyId: input.propertyId,
        startDate: formatDate(previousStart),
        endDate: formatDate(previousEnd),
        dimensions: ["date"],
        metrics: ["sessions", "bounceRate", "averageSessionDuration"]
      }),
      runGaReport({
        accessToken: input.accessToken,
        propertyId: input.propertyId,
        startDate: formatDate(currentStart),
        endDate: formatDate(endDate),
        dimensions: ["pagePath"],
        metrics: ["sessions", "bounceRate", "averageSessionDuration"],
        limit: 5,
        orderByMetric: "sessions"
      }),
      runGaReport({
        accessToken: input.accessToken,
        propertyId: input.propertyId,
        startDate: formatDate(currentStart),
        endDate: formatDate(endDate),
        dimensions: ["deviceCategory"],
        metrics: ["sessions"],
        limit: 10,
        orderByMetric: "sessions"
      }),
      runGaReport({
        accessToken: input.accessToken,
        propertyId: input.propertyId,
        startDate: formatDate(currentStart),
        endDate: formatDate(endDate),
        dimensions: ["country"],
        metrics: ["sessions"],
        limit: 5,
        orderByMetric: "sessions"
      })
    ]);

  const daily: GaDailyPoint[] = (dailyResponse.rows ?? []).map((row) => {
    const date = parseGaDate(row.dimensionValues?.[0]?.value ?? "19700101");
    return {
      date: date.date,
      label: date.label,
      sessions: Number(row.metricValues?.[0]?.value ?? 0),
      bounceRate: Number(Number(row.metricValues?.[1]?.value ?? 0).toFixed(1)),
      averageSessionDuration: Number(Number(row.metricValues?.[2]?.value ?? 0).toFixed(1))
    };
  });
  const previousDaily: GaDailyPoint[] = (previousResponse.rows ?? []).map((row) => {
    const date = parseGaDate(row.dimensionValues?.[0]?.value ?? "19700101");
    return {
      date: date.date,
      label: date.label,
      sessions: Number(row.metricValues?.[0]?.value ?? 0),
      bounceRate: Number(Number(row.metricValues?.[1]?.value ?? 0).toFixed(1)),
      averageSessionDuration: Number(Number(row.metricValues?.[2]?.value ?? 0).toFixed(1))
    };
  });
  const currentSummary = summarizeDaily(daily);
  const previousSummary = summarizeDaily(previousDaily);
  const topPages: GaTopPage[] = (topPagesResponse.rows ?? []).map((row) => ({
    page: row.dimensionValues?.[0]?.value ?? "/",
    sessions: Number(row.metricValues?.[0]?.value ?? 0),
    bounceRate: Number(Number(row.metricValues?.[1]?.value ?? 0).toFixed(1)),
    averageSessionDuration: Number(Number(row.metricValues?.[2]?.value ?? 0).toFixed(1))
  }));
  const deviceTotal = (devicesResponse.rows ?? []).reduce(
    (sum, row) => sum + Number(row.metricValues?.[0]?.value ?? 0),
    0
  );
  const devices: DeviceBreakdownPoint[] = (devicesResponse.rows ?? []).map((row) => {
    const sessions = Number(row.metricValues?.[0]?.value ?? 0);
    return {
      device: row.dimensionValues?.[0]?.value ?? "unknown",
      sessions,
      share: Number(((sessions / Math.max(deviceTotal, 1)) * 100).toFixed(1))
    };
  });
  const countries = (countriesResponse.rows ?? []).map((row) => ({
    country: row.dimensionValues?.[0]?.value ?? "Unknown",
    sessions: Number(row.metricValues?.[0]?.value ?? 0)
  }));

  return {
    connected: true,
    source: "live" as const,
    propertyId: input.propertyId,
    lastSyncedAt: new Date().toISOString(),
    summary: currentSummary,
    comparison: {
      sessions: percentDelta(currentSummary.sessions, previousSummary.sessions),
      bounceRate: improvementDelta(currentSummary.bounceRate, previousSummary.bounceRate),
      averageSessionDuration: percentDelta(
        currentSummary.averageSessionDuration,
        previousSummary.averageSessionDuration
      )
    },
    daily,
    sparkline: daily.map((point) => point.sessions),
    topPages,
    devices,
    countries
  } satisfies GaDashboardData;
}
