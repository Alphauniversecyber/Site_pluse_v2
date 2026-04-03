import type {
  BrokenLinkRecord,
  CruxDataRecord,
  ScanResult,
  SecurityHeadersRecord,
  SeoAuditRecord,
  SslCheckRecord,
  UptimeCheckRecord
} from "@/types";

function scoreFromSsl(sslCheck: SslCheckRecord | null | undefined) {
  if (!sslCheck) {
    return 50;
  }

  if (sslCheck.grade === "green") return 100;
  if (sslCheck.grade === "orange") return 75;
  if (sslCheck.grade === "red") return 40;
  return 5;
}

function scoreFromSecurityHeaders(headers: SecurityHeadersRecord | null | undefined) {
  if (!headers) {
    return 50;
  }

  if (headers.grade === "A") return 100;
  if (headers.grade === "B") return 80;
  if (headers.grade === "C") return 55;
  return 15;
}

function scoreFromSeoAudit(seoAudit: SeoAuditRecord | null | undefined) {
  if (!seoAudit) {
    return 50;
  }

  let score = 100;

  if (seoAudit.title_tag.status === "Missing") score -= 18;
  else if (seoAudit.title_tag.status !== "Good") score -= 8;

  if (seoAudit.meta_description.status === "Missing") score -= 18;
  else if (seoAudit.meta_description.status !== "Good") score -= 8;

  if (seoAudit.headings.status === "Missing") score -= 14;
  else if (seoAudit.headings.status !== "Good") score -= 8;

  if (seoAudit.images_missing_alt > 0) {
    score -= Math.min(12, seoAudit.images_missing_alt * 2);
  }

  if (!seoAudit.og_tags.title || !seoAudit.og_tags.description || !seoAudit.og_tags.image) {
    score -= 8;
  }

  if (!seoAudit.twitter_tags.card || !seoAudit.twitter_tags.title) {
    score -= 5;
  }

  if (!seoAudit.canonical.exists) score -= 10;
  else if (!seoAudit.canonical.self_referencing) score -= 6;

  if (!seoAudit.schema_present) {
    score -= 7;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

function scoreFromUptime(uptimeChecks: UptimeCheckRecord[] | null | undefined) {
  if (!uptimeChecks?.length) {
    return 50;
  }

  const threshold = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recent = uptimeChecks.filter((item) => new Date(item.checked_at).getTime() >= threshold);
  if (!recent.length) {
    return 50;
  }

  const upCount = recent.filter((item) => item.status === "up").length;
  return Math.round((upCount / recent.length) * 100);
}

export function buildHealthScore(input: {
  scan: ScanResult | null | undefined;
  seoAudit?: SeoAuditRecord | null;
  sslCheck?: SslCheckRecord | null;
  securityHeaders?: SecurityHeadersRecord | null;
  uptimeChecks?: UptimeCheckRecord[] | null;
}) {
  if (!input.scan) {
    return {
      overall: 0,
      breakdown: {
        performance: 0,
        seo: 0,
        security: 0,
        uptime: 0,
        accessibility: 0
      }
    };
  }

  const performance = input.scan.performance_score;
  const seo = scoreFromSeoAudit(input.seoAudit);
  const security = Math.round((scoreFromSsl(input.sslCheck) + scoreFromSecurityHeaders(input.securityHeaders)) / 2);
  const uptime = scoreFromUptime(input.uptimeChecks);
  const accessibility = input.scan.accessibility_score;

  const overall = Math.round(
    performance * 0.3 +
      seo * 0.25 +
      security * 0.2 +
      uptime * 0.15 +
      accessibility * 0.1
  );

  return {
    overall,
    breakdown: {
      performance,
      seo,
      security,
      uptime,
      accessibility
    }
  };
}

export function buildUptimeSummary(uptimeChecks: UptimeCheckRecord[] | null | undefined) {
  const threshold = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recent = (uptimeChecks ?? []).filter((item) => new Date(item.checked_at).getTime() >= threshold);
  const total = recent.length;
  const up = recent.filter((item) => item.status === "up").length;
  const responseTimeSamples = recent
    .map((item) => item.response_time_ms)
    .filter((value): value is number => typeof value === "number" && value > 0);

  return {
    percentage: total ? Math.round((up / total) * 1000) / 10 : 0,
    averageResponseMs: responseTimeSamples.length
      ? Math.round(responseTimeSamples.reduce((sum, value) => sum + value, 0) / responseTimeSamples.length)
      : null,
    incidents: recent
      .filter((item) => item.status === "down")
      .slice(0, 5)
  };
}

export function buildCruxSummary(cruxData: CruxDataRecord | null | undefined) {
  if (!cruxData) {
    return null;
  }

  return {
    lcp: {
      good: cruxData.lcp_good_pct,
      needs: cruxData.lcp_needs_pct,
      poor: cruxData.lcp_poor_pct
    },
    cls: {
      good: cruxData.cls_good_pct,
      needs: cruxData.cls_needs_pct,
      poor: cruxData.cls_poor_pct
    },
    inp: {
      good: cruxData.inp_good_pct,
      needs: cruxData.inp_needs_pct,
      poor: cruxData.inp_poor_pct
    },
    fcp: {
      good: cruxData.fcp_good_pct,
      needs: cruxData.fcp_needs_pct,
      poor: cruxData.fcp_poor_pct
    },
    ttfb: {
      good: cruxData.ttfb_good_pct,
      needs: cruxData.ttfb_needs_pct,
      poor: cruxData.ttfb_poor_pct
    }
  };
}

export function buildLinkHealthSummary(record: BrokenLinkRecord | null | undefined) {
  if (!record) {
    return null;
  }

  return {
    totalLinks: record.total_links,
    brokenLinks: record.broken_links,
    redirectChains: record.redirect_chains,
    brokenUrls: record.broken_urls.slice(0, 8)
  };
}
