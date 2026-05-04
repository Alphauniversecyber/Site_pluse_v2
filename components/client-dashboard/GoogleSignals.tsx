import type { GaDashboardData, GscDashboardData } from "@/types";
import { ConnectCard } from "@/components/client-dashboard/ConnectCard";
import { GAChart } from "@/components/client-dashboard/GAChart";
import { Skeleton } from "@/components/ui/skeleton";

function QueryTable({ gsc }: { gsc: GscDashboardData }) {
  if (!gsc.topQueries.length) {
    return (
      <div className="rounded-[1.8rem] border border-border/70 bg-card/90 p-5 shadow-[0_30px_80px_-48px_rgba(15,23,42,0.38)] backdrop-blur-xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Top Queries</p>
        <div className="mt-4 rounded-[1.4rem] border border-dashed border-border bg-background/70 px-5 py-8 text-center">
          <p className="font-display text-xl font-semibold text-foreground">No query data yet</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Search Console will list the queries people use to find this site once live data starts syncing.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[1.8rem] border border-border/70 bg-card/90 p-5 shadow-[0_30px_80px_-48px_rgba(15,23,42,0.38)] backdrop-blur-xl">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Top Queries</p>
      <div className="mt-4 space-y-3 md:hidden">
        {gsc.topQueries.map((query) => (
          <div key={query.query} className="rounded-[1.2rem] border border-border bg-background/70 p-4">
            <p className="font-medium text-foreground">{query.query}</p>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-muted-foreground">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em]">Clicks</p>
                <p className="mt-1 text-base font-semibold text-foreground">{query.clicks.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em]">Impressions</p>
                <p className="mt-1 text-base font-semibold text-foreground">{query.impressions.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em]">CTR</p>
                <p className="mt-1 text-base font-semibold text-foreground">{query.ctr.toFixed(2)}%</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em]">Position</p>
                <p className="mt-1 text-base font-semibold text-foreground">{query.position.toFixed(1)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 hidden overflow-x-auto md:block">
        <table className="min-w-full text-left text-sm text-foreground">
          <thead className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            <tr>
              <th className="px-0 py-3">Query</th>
              <th className="px-3 py-3">Clicks</th>
              <th className="px-3 py-3">Impressions</th>
              <th className="px-3 py-3">CTR</th>
              <th className="px-3 py-3">Position</th>
            </tr>
          </thead>
          <tbody>
            {gsc.topQueries.map((query) => (
              <tr key={query.query} className="border-t border-border/70">
                <td className="py-3">{query.query}</td>
                <td className="px-3 py-3">{query.clicks.toLocaleString()}</td>
                <td className="px-3 py-3">{query.impressions.toLocaleString()}</td>
                <td className="px-3 py-3">{query.ctr.toFixed(2)}%</td>
                <td className="px-3 py-3">{query.position.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PageTable({ ga }: { ga: GaDashboardData }) {
  if (!ga.topPages.length) {
    return (
      <div className="rounded-[1.8rem] border border-border/70 bg-card/90 p-5 shadow-[0_30px_80px_-48px_rgba(15,23,42,0.38)] backdrop-blur-xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Top Pages</p>
        <div className="mt-4 rounded-[1.4rem] border border-dashed border-border bg-background/70 px-5 py-8 text-center">
          <p className="font-display text-xl font-semibold text-foreground">No page data yet</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            GA4 will highlight the busiest pages here after the first successful analytics sync.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[1.8rem] border border-border/70 bg-card/90 p-5 shadow-[0_30px_80px_-48px_rgba(15,23,42,0.38)] backdrop-blur-xl">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Top Pages</p>
      <div className="mt-4 space-y-3 md:hidden">
        {ga.topPages.map((page) => (
          <div key={page.page} className="rounded-[1.2rem] border border-border bg-background/70 p-4">
            <p className="font-medium text-foreground">{page.page}</p>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-muted-foreground">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em]">Sessions</p>
                <p className="mt-1 text-base font-semibold text-foreground">{page.sessions.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em]">Bounce Rate</p>
                <p className="mt-1 text-base font-semibold text-foreground">{page.bounceRate.toFixed(1)}%</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 hidden overflow-x-auto md:block">
        <table className="min-w-full text-left text-sm text-foreground">
          <thead className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            <tr>
              <th className="px-0 py-3">Page</th>
              <th className="px-3 py-3">Sessions</th>
              <th className="px-3 py-3">Bounce Rate</th>
            </tr>
          </thead>
          <tbody>
            {ga.topPages.map((page) => (
              <tr key={page.page} className="border-t border-border/70">
                <td className="py-3">{page.page}</td>
                <td className="px-3 py-3">{page.sessions.toLocaleString()}</td>
                <td className="px-3 py-3">{page.bounceRate.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function GoogleSignals({
  token,
  gsc,
  ga,
  gscLoading,
  gaLoading
}: {
  token: string;
  gsc: GscDashboardData;
  ga: GaDashboardData;
  gscLoading?: boolean;
  gaLoading?: boolean;
}) {
  const waitingForLiveData = (gsc.connected && gsc.source !== "live") || (ga.connected && ga.source !== "live");

  if (!gsc.connected || !ga.connected) {
    return (
      <div className="space-y-6">
        {!gsc.connected ? (
          <div className="rounded-[1.8rem] border border-border/70 bg-card/90 p-6 shadow-[0_30px_80px_-48px_rgba(15,23,42,0.38)] backdrop-blur-xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Before you connect Search Console
            </p>
            <div className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">
              <p>1. Go to search.google.com/search-console and sign in with the Google account that owns this website.</p>
              <p>2. Add your site as a Property if you haven&apos;t already. Use the URL Prefix option and enter your exact domain.</p>
              <p>3. Verify ownership using the HTML tag method or Google Analytics method.</p>
              <p>4. Wait 24-48 hours for Google to start collecting data before connecting here.</p>
              <p>5. Once verified, click Connect Google Search Console below and sign in with the same Google account.</p>
            </div>
          </div>
        ) : null}
        <div className="grid gap-6 lg:grid-cols-2">
          {!gsc.connected ? <ConnectCard service="gsc" token={token} /> : null}
          {!ga.connected ? <ConnectCard service="ga" token={token} /> : null}
        </div>
        <div className="rounded-[1.8rem] border border-dashed border-border bg-card/60 p-5 text-sm text-muted-foreground">
          Connect both Google sources to unlock the combined top queries, top pages, device mix, and country breakdown panels.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {gscLoading || gaLoading ? (
        <div className="flex items-center gap-3 rounded-full border border-border bg-card/70 px-4 py-3">
          <Skeleton className="h-2 w-16 bg-muted" />
          <Skeleton className="h-2 w-12 bg-muted" />
          <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Syncing live signals</span>
        </div>
      ) : null}

      {waitingForLiveData ? (
        <div className="rounded-[1.6rem] border border-amber-500/20 bg-amber-500/10 px-5 py-4 text-sm text-amber-700 dark:text-amber-200">
          Google is connected, but SitePulse is still waiting for a successful live sync. Once data comes through, these panels will update automatically.
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <QueryTable gsc={gsc} />
        <PageTable ga={ga} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-[1.8rem] border border-border/70 bg-card/90 p-5 shadow-[0_30px_80px_-48px_rgba(15,23,42,0.38)] backdrop-blur-xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Sessions by Device</p>
          <div className="mt-4">
            <GAChart variant="device" devices={ga.devices} loading={gaLoading && ga.source !== "live"} />
          </div>
        </div>

        <div className="rounded-[1.8rem] border border-border/70 bg-card/90 p-5 shadow-[0_30px_80px_-48px_rgba(15,23,42,0.38)] backdrop-blur-xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Top 5 Countries</p>
          <div className="mt-4">
            <GAChart variant="country" countries={ga.countries} loading={gaLoading && ga.source !== "live"} />
          </div>
        </div>
      </div>
    </div>
  );
}
