import "server-only";

import type { CruxDataRecord } from "@/types";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const CRUX_ENDPOINT = "https://chromeuxreport.googleapis.com/v1/records:queryRecord";
const CRUX_CACHE_HOURS = 24;
const CRUX_METRICS = [
  "largest_contentful_paint",
  "cumulative_layout_shift",
  "interaction_to_next_paint",
  "first_contentful_paint",
  "experimental_time_to_first_byte"
] as const;

type CruxHistogram = Array<{
  start?: number;
  end?: number;
  density?: number;
}>;

type CruxMetricPayload = {
  histogram?: CruxHistogram;
  percentiles?: {
    p75?: number;
  };
};

type CruxResponse = {
  record?: {
    key?: Record<string, unknown>;
    metrics?: Record<string, CruxMetricPayload>;
  };
};

function isFresh(timestamp: string, hours: number) {
  return Date.now() - new Date(timestamp).getTime() < hours * 60 * 60 * 1000;
}

function toPercent(value?: number) {
  return Math.round((value ?? 0) * 10000) / 100;
}

function parseDistribution(metric?: CruxMetricPayload) {
  const histogram = metric?.histogram ?? [];

  return {
    good: toPercent(histogram[0]?.density),
    needs: toPercent(histogram[1]?.density),
    poor: toPercent(histogram[2]?.density)
  };
}

export async function ensureCruxData(input: {
  websiteId: string;
  url: string;
  force?: boolean;
}) {
  if (!process.env.CRUX_API_KEY) {
    return null;
  }

  const admin = createSupabaseAdminClient();
  const { data: latest } = await admin
    .from("crux_data")
    .select("*")
    .eq("website_id", input.websiteId)
    .order("fetched_at", { ascending: false })
    .limit(1)
    .maybeSingle<CruxDataRecord>();

  if (!input.force && latest?.fetched_at && isFresh(latest.fetched_at, CRUX_CACHE_HOURS)) {
    return latest;
  }

  const origin = new URL(input.url).origin;
  const response = await fetch(`${CRUX_ENDPOINT}?key=${encodeURIComponent(process.env.CRUX_API_KEY)}`, {
    method: "POST",
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      origin,
      metrics: CRUX_METRICS
    })
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(message || `CrUX request failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as CruxResponse;
  const metrics = payload.record?.metrics ?? {};
  const lcp = parseDistribution(metrics.largest_contentful_paint);
  const cls = parseDistribution(metrics.cumulative_layout_shift);
  const inp = parseDistribution(metrics.interaction_to_next_paint);
  const fcp = parseDistribution(metrics.first_contentful_paint);
  const ttfb = parseDistribution(metrics.experimental_time_to_first_byte);

  const record = {
    website_id: input.websiteId,
    lcp_good_pct: lcp.good,
    lcp_needs_pct: lcp.needs,
    lcp_poor_pct: lcp.poor,
    cls_good_pct: cls.good,
    cls_needs_pct: cls.needs,
    cls_poor_pct: cls.poor,
    inp_good_pct: inp.good,
    inp_needs_pct: inp.needs,
    inp_poor_pct: inp.poor,
    fcp_good_pct: fcp.good,
    fcp_needs_pct: fcp.needs,
    fcp_poor_pct: fcp.poor,
    ttfb_good_pct: ttfb.good,
    ttfb_needs_pct: ttfb.needs,
    ttfb_poor_pct: ttfb.poor,
    raw_payload: payload,
    fetched_at: new Date().toISOString()
  };

  const { data, error } = await admin.from("crux_data").insert(record).select("*").single();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to store CrUX data.");
  }

  return data as CruxDataRecord;
}
