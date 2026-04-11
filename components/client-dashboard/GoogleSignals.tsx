import type { GaDashboardData, GscDashboardData } from "@/types";
import { ConnectCard } from "@/components/client-dashboard/ConnectCard";
import { GAChart } from "@/components/client-dashboard/GAChart";
import { Skeleton } from "@/components/ui/skeleton";

function QueryTable({ gsc }: { gsc: GscDashboardData }) {
  return (
    <div className="rounded-[1.8rem] border border-white/10 bg-white/[0.05] p-5 shadow-[0_24px_64px_-36px_rgba(15,23,42,0.72)] backdrop-blur-xl">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Top Queries</p>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-left text-sm text-slate-200">
          <thead className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
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
              <tr key={query.query} className="border-t border-white/8">
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
  return (
    <div className="rounded-[1.8rem] border border-white/10 bg-white/[0.05] p-5 shadow-[0_24px_64px_-36px_rgba(15,23,42,0.72)] backdrop-blur-xl">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Top Pages</p>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-left text-sm text-slate-200">
          <thead className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
            <tr>
              <th className="px-0 py-3">Page</th>
              <th className="px-3 py-3">Sessions</th>
              <th className="px-3 py-3">Bounce Rate</th>
            </tr>
          </thead>
          <tbody>
            {ga.topPages.map((page) => (
              <tr key={page.page} className="border-t border-white/8">
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
  if (!gsc.connected || !ga.connected) {
    return (
      <div className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          {!gsc.connected ? <ConnectCard service="gsc" token={token} /> : null}
          {!ga.connected ? <ConnectCard service="ga" token={token} /> : null}
        </div>
        <div className="rounded-[1.8rem] border border-dashed border-white/10 bg-white/[0.03] p-5 text-sm text-slate-300">
          Connect both Google sources to unlock the combined top queries, top pages, device mix, and country breakdown panels.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {gscLoading || gaLoading ? (
        <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.04] px-4 py-3">
          <Skeleton className="h-2 w-16 bg-white/15" />
          <Skeleton className="h-2 w-12 bg-white/15" />
          <span className="text-xs uppercase tracking-[0.18em] text-slate-400">Syncing live signals</span>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <QueryTable gsc={gsc} />
        <PageTable ga={ga} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-[1.8rem] border border-white/10 bg-white/[0.05] p-5 shadow-[0_24px_64px_-36px_rgba(15,23,42,0.72)] backdrop-blur-xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Sessions by Device</p>
          <div className="mt-4">
            <GAChart variant="device" devices={ga.devices} loading={gaLoading && ga.source === "mock"} />
          </div>
        </div>

        <div className="rounded-[1.8rem] border border-white/10 bg-white/[0.05] p-5 shadow-[0_24px_64px_-36px_rgba(15,23,42,0.72)] backdrop-blur-xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Top 5 Countries</p>
          <div className="mt-4">
            <GAChart variant="country" countries={ga.countries} loading={gaLoading && ga.source === "mock"} />
          </div>
        </div>
      </div>
    </div>
  );
}
