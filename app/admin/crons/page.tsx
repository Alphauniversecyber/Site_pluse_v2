import { AdminBadge } from "@/components/admin/admin-badge";
import { AdminCard } from "@/components/admin/admin-card";
import { AdminErrorNotice } from "@/components/admin/admin-error-notice";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { requireAdminPageAccess } from "@/lib/admin/auth";
import { getAdminCronsData } from "@/lib/admin/data";
import { formatAdminDate, parseTextParam } from "@/lib/admin/format";

import { runAdminCronAction } from "./actions";

export default async function AdminCronsPage({
  searchParams
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  requireAdminPageAccess();

  const run = parseTextParam(searchParams?.run);
  const status = parseTextParam(searchParams?.status);
  const message = parseTextParam(searchParams?.message);
  const data = await getAdminCronsData();

  return (
    <div>
      <AdminPageHeader
        title="Crons"
        description="Monitor schedules, inspect the last 10 runs of each cron, and manually kick off a job when you need to recover backlog or debug production behavior."
      />

      <AdminErrorNotice message={data.error} />

      {message ? (
        <div
          className={`mb-6 rounded-2xl border px-4 py-3 text-sm ${
            status === "success"
              ? "border-[#14532D] bg-[#052E16] text-[#86EFAC]"
              : "border-[#7F1D1D] bg-[#450A0A] text-[#FCA5A5]"
          }`}
        >
          {run ? `${run}: ` : null}
          {message}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        {data.rows.map((row) => (
          <AdminCard key={row.name}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#22C55E]">{row.name}</p>
                <p className="mt-2 text-sm leading-6 text-zinc-400">{row.description}</p>
              </div>
              <form action={runAdminCronAction}>
                <input type="hidden" name="cronName" value={row.name} />
                <button
                  type="submit"
                  className="rounded-full border border-[#1D4ED8] bg-[#172554] px-4 py-2 text-sm font-medium text-[#BFDBFE]"
                >
                  Run Now
                </button>
              </form>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-[#1F1F1F] bg-[#0D0D0D] p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Schedule</p>
                <p className="mt-2 font-mono text-sm text-white">{row.schedule}</p>
                <p className="mt-2 text-sm text-zinc-500">{formatAdminDate(row.nextRunAt)}</p>
              </div>
              <div className="rounded-2xl border border-[#1F1F1F] bg-[#0D0D0D] p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Last run</p>
                <p className="mt-2 text-sm text-white">{row.lastRunAt ? formatAdminDate(row.lastRunAt) : "Never"}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <AdminBadge
                    label={row.lastRunStatus}
                    tone={
                      row.lastRunStatus === "success"
                        ? "green"
                        : row.lastRunStatus === "running"
                          ? "blue"
                          : row.lastRunStatus === "never"
                            ? "neutral"
                            : "red"
                    }
                  />
                  <AdminBadge label={`${row.itemsProcessed} items`} tone="neutral" mono />
                </div>
                <p className="mt-2 text-xs font-mono text-zinc-500">{row.lastRunDuration}</p>
              </div>
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl border border-[#1F1F1F]">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[#0F0F0F] text-zinc-400">
                  <tr>
                    <th className="px-3 py-2 font-medium">Started</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Duration</th>
                    <th className="px-3 py-2 font-medium">Items</th>
                  </tr>
                </thead>
                <tbody>
                  {row.history.length ? (
                    row.history.map((historyRow, index) => (
                      <tr key={historyRow.id} className={index % 2 === 0 ? "bg-[#101010]" : "bg-[#141414]"}>
                        <td className="px-3 py-2 font-mono text-xs text-zinc-400">{formatAdminDate(historyRow.started_at)}</td>
                        <td className="px-3 py-2">
                          <AdminBadge
                            label={historyRow.status}
                            tone={
                              historyRow.status === "success"
                                ? "green"
                                : historyRow.status === "running"
                                  ? "blue"
                                  : historyRow.status === "timeout"
                                    ? "amber"
                                    : "red"
                            }
                          />
                        </td>
                        <td className="px-3 py-2 text-zinc-300">
                          {historyRow.started_at && historyRow.finished_at
                            ? `${Math.round((new Date(historyRow.finished_at).getTime() - new Date(historyRow.started_at).getTime()) / 100) / 10}s`
                            : "Still running"}
                        </td>
                        <td className="px-3 py-2 text-zinc-300">{historyRow.items_processed ?? 0}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-sm text-zinc-500">
                        No cron history has been logged yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </AdminCard>
        ))}
      </div>
    </div>
  );
}
