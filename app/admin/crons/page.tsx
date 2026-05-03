import { AdminBadge } from "@/components/admin/admin-badge";
import { AdminCard } from "@/components/admin/admin-card";
import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminErrorNotice } from "@/components/admin/admin-error-notice";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminSeriesChart } from "@/components/admin/admin-series-chart";
import { AdminActionButton } from "@/components/admin/admin-action-button";
import { requireAdminPageAccess } from "@/lib/admin/auth";
import { getAdminCronsData, getAdminFailedTasksData } from "@/lib/admin/data";
import { getAdminScanMonitoringData } from "@/lib/admin/scan-monitoring";
import { formatAdminDate, parseTextParam } from "@/lib/admin/format";

import { runAdminCronAction } from "./actions";
import { FailedTasksTable } from "./failed-tasks-table";

function getStatusTone(status: string) {
  if (status === "success" || status === "completed") {
    return "green" as const;
  }

  if (status === "running" || status === "processing") {
    return "blue" as const;
  }

  if (status === "pending" || status === "timeout") {
    return "amber" as const;
  }

  return "red" as const;
}

export default async function AdminCronsPage({
  searchParams
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  requireAdminPageAccess();

  const run = parseTextParam(searchParams?.run);
  const status = parseTextParam(searchParams?.status);
  const message = parseTextParam(searchParams?.message);
  const scanUser = parseTextParam(searchParams?.scanUser);
  const scanStatus = parseTextParam(searchParams?.scanStatus) || "all";
  const scanDate = parseTextParam(searchParams?.scanDate);
  const failedStatus = parseTextParam(searchParams?.failedStatus) || "all";
  const failedRange = parseTextParam(searchParams?.failedRange) || "7d";
  const data = await getAdminCronsData();
  const failedTasks = await getAdminFailedTasksData({
    status: failedStatus === "all" || failedStatus === "failed" || failedStatus === "retried" || failedStatus === "resolved" ? failedStatus : "all",
    range: failedRange === "30d" || failedRange === "all" ? failedRange : "7d"
  });
  const monitoring = await getAdminScanMonitoringData({
    user: scanUser,
    status: scanStatus,
    date: scanDate
  });

  return (
    <div>
      <AdminPageHeader
        title="Crons"
        description="Monitor GitHub Actions schedules, see which websites are due for scans, and understand the difference between cron triggers, queue backlog, and completed downstream work."
      />

      <AdminErrorNotice message={data.error} />
      <AdminErrorNotice message={failedTasks.error} />
      <AdminErrorNotice message={monitoring.error} />

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

      <div className="mb-8">
        <div className="mb-4 flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#22C55E]">Scan Monitoring</p>
          <h2 className="text-2xl font-semibold text-white">Required vs completed scans</h2>
          <p className="max-w-3xl text-sm leading-6 text-zinc-400">
            Due scans are calculated from each website&apos;s schedule, the owner&apos;s plan limits, duplicate prevention rules, and the owner&apos;s timezone-aware scan period.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <AdminCard>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Due websites today</p>
            <p className="mt-4 text-3xl font-semibold text-white">{monitoring.summary.requiredToday}</p>
            <p className="mt-2 text-sm text-zinc-500">Websites that should have been scanned in the current period.</p>
          </AdminCard>
          <AdminCard>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Scans completed today</p>
            <p className="mt-4 text-3xl font-semibold text-[#86EFAC]">{monitoring.summary.completedToday}</p>
            <p className="mt-2 text-sm text-zinc-500">Due websites whose scan worker finished and stored a fresh scan result.</p>
          </AdminCard>
          <AdminCard>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Due but still unresolved</p>
            <p className="mt-4 text-3xl font-semibold text-[#FCA5A5]">{monitoring.summary.failedPendingToday}</p>
            <p className="mt-2 text-sm text-zinc-500">Includes queue backlog, timeouts, skipped sites, ineligible accounts, and plan-limited websites.</p>
          </AdminCard>
          <AdminCard>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Last scan cron</p>
            <p className="mt-4 text-lg font-semibold text-white">{formatAdminDate(monitoring.cron.lastRunAt)}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <AdminBadge label={monitoring.cron.lastRunStatus} tone={getStatusTone(monitoring.cron.lastRunStatus)} />
              <AdminBadge label={`${monitoring.cron.lastRunProcessed} items`} tone="neutral" mono />
            </div>
          </AdminCard>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr,1fr]">
          <div className="space-y-6">
            <AdminCard>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">Today&apos;s scan progress</p>
                  <p className="mt-1 text-sm leading-6 text-zinc-400">
                    {monitoring.progress.completed} of {monitoring.progress.required} required scans are complete.
                  </p>
                  <p className="mt-2 text-xs leading-5 text-zinc-500">
                    A green GitHub Actions run means the cron triggered and drained worker batches. It does not guarantee every due website finished scanning successfully.
                  </p>
                </div>
                <AdminBadge label={`${monitoring.progress.percent}% complete`} tone={monitoring.progress.percent >= 100 ? "green" : monitoring.progress.percent >= 50 ? "amber" : "red"} />
              </div>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-[#0D0D0D]">
                <div
                  className="h-full rounded-full bg-[#22C55E] transition-[width] duration-300"
                  style={{ width: `${monitoring.progress.percent}%` }}
                />
              </div>
            </AdminCard>

            <AdminSeriesChart
              title="Scans completed vs required"
              description="Daily queue activity for website scans over the last 7 days."
              points={monitoring.chart}
              series={[
                { key: "required", label: "Required", tone: "blue" },
                { key: "completed", label: "Completed", tone: "green" },
                { key: "failed", label: "Failed", tone: "red" }
              ]}
            />
          </div>

          <AdminCard>
          <form action="/admin/crons" className="grid gap-4">
              <input type="hidden" name="failedStatus" value={failedTasks.filters.status} />
              <input type="hidden" name="failedRange" value={failedTasks.filters.range} />
              <div>
                <label htmlFor="scanUser" className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                  User / Website
                </label>
                <input
                  id="scanUser"
                  name="scanUser"
                  defaultValue={monitoring.filters.user}
                  placeholder="email, user id, or website"
                  className="mt-2 w-full rounded-2xl border border-[#27272A] bg-[#0D0D0D] px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500"
                />
              </div>
              <div>
                <label htmlFor="scanStatus" className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                  Status
                </label>
                <select
                  id="scanStatus"
                  name="scanStatus"
                  defaultValue={monitoring.filters.status}
                  className="mt-2 w-full rounded-2xl border border-[#27272A] bg-[#0D0D0D] px-4 py-3 text-sm text-white outline-none"
                >
                  <option value="all">All statuses</option>
                  <option value="pending">Pending</option>
                  <option value="processing">Processing</option>
                  <option value="failed">Failed</option>
                  <option value="skipped">Skipped</option>
                </select>
              </div>
              <div>
                <label htmlFor="scanDate" className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                  Last scan date
                </label>
                <input
                  id="scanDate"
                  name="scanDate"
                  type="date"
                  defaultValue={monitoring.filters.date}
                  className="mt-2 w-full rounded-2xl border border-[#27272A] bg-[#0D0D0D] px-4 py-3 text-sm text-white outline-none"
                />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  className="rounded-full border border-[#1D4ED8] bg-[#172554] px-4 py-2 text-sm font-medium text-[#BFDBFE]"
                >
                  Apply filters
                </button>
                <a href="/admin/crons" className="text-sm text-zinc-400 underline-offset-4 hover:text-white hover:underline">
                  Reset
                </a>
              </div>
            </form>
          </AdminCard>
        </div>

        <div className="mt-6">
          {monitoring.rows.length ? (
            <AdminCard className="overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-[#0D0D0D] text-zinc-400">
                    <tr>
                      <th className="px-4 py-3 font-medium">Website</th>
                      <th className="px-4 py-3 font-medium">User</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Reason</th>
                      <th className="px-4 py-3 font-medium">Last Scan Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monitoring.rows.map((row, index) => (
                      <tr key={row.id} className={`${index % 2 === 0 ? "bg-[#101010]" : "bg-[#141414]"} align-top hover:bg-[#181818]`}>
                        <td className="px-4 py-4 text-zinc-300">
                          <p className="font-medium text-white">{row.websiteLabel}</p>
                          <p className="mt-1 break-all text-xs text-zinc-500">{row.websiteUrl}</p>
                        </td>
                        <td className="px-4 py-4">
                          <p className="break-all font-medium text-white">{row.email}</p>
                          <p className="mt-1 font-mono text-xs text-zinc-500">{row.userId}</p>
                          <p className="mt-2 text-xs uppercase tracking-[0.16em] text-[#86EFAC]">{row.planLabel}</p>
                        </td>
                        <td className="px-4 py-4">
                          <AdminBadge label={row.status} tone={getStatusTone(row.status)} />
                        </td>
                        <td className="px-4 py-4 text-zinc-300">
                          <p>{row.reason}</p>
                          {row.lastError ? <p className="mt-2 text-xs leading-5 text-[#FCA5A5]">{row.lastError}</p> : null}
                        </td>
                        <td className="px-4 py-4 font-mono text-xs text-zinc-500">{formatAdminDate(row.lastScanTime)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </AdminCard>
          ) : (
            <AdminEmptyState
              title="No missed scans for the selected filters"
              description="Every website that should be scanned right now has either completed successfully or there is no backlog matching the selected filters."
            />
          )}
        </div>
      </div>

      <div className="mb-8">
        <div className="mb-4 flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#FCA5A5]">Failed Tasks</p>
          <h2 className="text-2xl font-semibold text-white">User and site-level retry queue</h2>
          <p className="max-w-3xl text-sm leading-6 text-zinc-400">
            These rows capture task-level failures inside cron runs, such as a single report PDF failing to generate or a single scheduled email failing to send.
          </p>
        </div>

        <AdminCard>
          <form className="grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
            <input type="hidden" name="scanUser" value={monitoring.filters.user} />
            <input type="hidden" name="scanStatus" value={monitoring.filters.status} />
            <input type="hidden" name="scanDate" value={monitoring.filters.date} />
            <select
              name="failedStatus"
              defaultValue={failedTasks.filters.status}
              className="rounded-2xl border border-[#2A2A2A] bg-[#0B0B0B] px-4 py-3 text-sm text-white outline-none focus:border-[#F97316]"
            >
              <option value="all">All statuses</option>
              <option value="failed">Failed</option>
              <option value="retried">Retried</option>
              <option value="resolved">Resolved</option>
            </select>
            <select
              name="failedRange"
              defaultValue={failedTasks.filters.range}
              className="rounded-2xl border border-[#2A2A2A] bg-[#0B0B0B] px-4 py-3 text-sm text-white outline-none focus:border-[#F97316]"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="all">All time</option>
            </select>
            <button type="submit" className="rounded-2xl bg-[#F97316] px-4 py-3 text-sm font-semibold text-white">
              Apply
            </button>
          </form>
        </AdminCard>

        <div className="mt-6">
          {failedTasks.rows.length ? (
            <AdminCard className="overflow-hidden p-0">
              <FailedTasksTable initialRows={failedTasks.rows} />
            </AdminCard>
          ) : (
            <AdminEmptyState
              title="No failed tasks for the selected filters"
              description="When a cron run hits a user-level or website-level task failure, it will appear here with enough context to retry it safely."
            />
          )}
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">Cron Definitions</p>
        <h2 className="text-2xl font-semibold text-white">Scheduled jobs and history</h2>
      </div>

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
                <AdminActionButton idleLabel="Run Now" pendingLabel="Running..." />
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
                  <AdminBadge label={`${row.itemsProcessed} ${row.itemLabel}`} tone="neutral" mono />
                </div>
                <p className="mt-2 text-xs font-mono text-zinc-500">{row.lastRunDuration}</p>
                {row.queueMetrics ? (
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-400">
                    <span>{row.queueMetrics.completedCount} {row.queueMetrics.completedLabel}</span>
                    <span>{row.queueMetrics.remainingCount} {row.queueMetrics.remainingLabel}</span>
                  </div>
                ) : null}
                {row.queueBacked ? (
                  <p className="mt-2 text-xs leading-5 text-zinc-500">
                    Queue-backed cron: this card shows trigger and drain activity. The actual website/report work may still be pending or blocked in the downstream queue.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl border border-[#1F1F1F]">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[#0F0F0F] text-zinc-400">
                  <tr>
                    <th className="px-3 py-2 font-medium">Started</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Duration</th>
                    <th className="px-3 py-2 font-medium">{row.queueBacked ? "Queue Jobs" : "Items"}</th>
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
