import type { ClientDashboardRewriteContext, GaDashboardData, GscDashboardData } from "@/types";

export const GOOGLE_CONTEXT_BANNER_COPY =
  "Connect Google Search Console and GA4 to get insights tailored to your actual traffic and rankings.";

export function buildClientDashboardRewriteContext(input: {
  websiteUrl: string;
  gsc: GscDashboardData;
  ga: GaDashboardData;
}): {
  context: ClientDashboardRewriteContext;
  showGoogleConnectBanner: boolean;
} {
  const showGoogleConnectBanner = !input.gsc.connected || !input.ga.connected;
  const includeGoogleInsights =
    !showGoogleConnectBanner && (input.gsc.source === "live" || input.ga.source === "live");

  return {
    showGoogleConnectBanner,
    context: {
      websiteUrl: input.websiteUrl,
      includeGoogleInsights,
      gsc: {
        connected: input.gsc.connected,
        live: includeGoogleInsights && input.gsc.source === "live",
        summary: {
          clicks: input.gsc.summary.clicks,
          impressions: input.gsc.summary.impressions,
          ctr: input.gsc.summary.ctr,
          avgPosition: input.gsc.summary.avgPosition
        },
        topQueries: input.gsc.topQueries.slice(0, 5),
        topPages: input.gsc.topPages.slice(0, 5)
      },
      ga: {
        connected: input.ga.connected,
        live: includeGoogleInsights && input.ga.source === "live",
        summary: {
          sessions: input.ga.summary.sessions,
          bounceRate: input.ga.summary.bounceRate,
          averageSessionDuration: input.ga.summary.averageSessionDuration
        },
        topPages: input.ga.topPages.slice(0, 5)
      }
    }
  };
}
