import { AdminBadge } from "@/components/admin/admin-badge";
import { AdminCard } from "@/components/admin/admin-card";
import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminErrorNotice } from "@/components/admin/admin-error-notice";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { AdminSeriesChart } from "@/components/admin/admin-series-chart";
import { requireAdminPageAccess } from "@/lib/admin/auth";
import { getAdminEmailMonitoringData } from "@/lib/admin/email-monitoring";
import { getAdminEmailsData } from "@/lib/admin/data";
import { formatAdminDate, parsePageParam } from "@/lib/admin/format";

function buildHref(
  page: number,
  filters: {
    user: string;
    status: string;
    date: string;
  }
) {
  const params = new URLSearchParams({ page: String(page) });

  if (filters.user) {
    params.set("monitorUser", filters.user);
  }

  if (filters.status && filters.status !== "all") {
    params.set("monitorStatus", filters.status);
  }

  if (filters.date) {
    params.set("monitorDate", filters.date);
  }

  return `/admin/emails?${params.toString()}`;
}

function getStatusTone(status: string) {
  if (status === "sent" || status === "success") {
    return "green" as const;
  }

  if (status === "processing") {
    return "blue" as const;
  }

  if (status === "pending") {
    return "amber" as const;
  }

  if (status === "never") {
    return "neutral" as const;
  }

  return "red" as const;
}

export default async function AdminEmailsPage({
  searchParams
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  requireAdminPageAccess();

  const page = parsePageParam(searchParams?.page, 1);
  const monitorUser = Array.isArray(searchParams?.monitorUser)
    ? searchParams?.monitorUser[0] ?? ""
    : searchParams?.monitorUser ?? "";
  const monitorStatus = Array.isArray(searchParams?.monitorStatus)
    ? searchParams?.monitorStatus[0] ?? "all"
    : searchParams?.monitorStatus ?? "all";
  const monitorDate = Array.isArray(searchParams?.monitorDate)
    ? searchParams?.monitorDate[0] ?? ""
    : searchParams?.monitorDate ?? "";
  const data = await getAdminEmailsData({ page });
  const monitoring = await getAdminEmailMonitoringData({
    user: monitorUser,
    status: monitorStatus,
    date: monitorDate
  });

  return (
    <div>
      <AdminPageHeader
        title="Emails"
        description="Monitor scheduled PDF report emails, see what should have gone out today, and inspect raw delivery activity from Resend in one place."
      />

      <AdminErrorNotice message={data.error} />
      <AdminErrorNotice message={monitoring.error} />

      <div className="mb-8">
        <div className="mb-4 flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#22C55E]">Email Monitoring</p>
          <h2 className="text-2xl font-semibold text-white">Scheduled PDF report emails</h2>
          <p className="max-w-3xl text-sm leading-6 text-zinc-400">
            This section only tracks report emails that should send a PDF attachment. Marketing and system emails are intentionally excluded.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <AdminCard>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Scheduled today</p>
            <p className="mt-4 text-3xl font-semibold text-white">{monitoring.summary.scheduledToday}</p>
            <p className="mt-2 text-sm text-zinc-500">Due by subscription, frequency, last sent date, and timezone-aware period.</p>
          </AdminCard>
          <AdminCard>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Sent today</p>
            <p className="mt-4 text-3xl font-semibold text-[#86EFAC]">{monitoring.summary.sentToday}</p>
            <p className="mt-2 text-sm text-zinc-500">Queue rows that successfully delivered the scheduled PDF report.</p>
          </AdminCard>
          <AdminCard>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Failed / Pending</p>
            <p className="mt-4 text-3xl font-semibold text-[#FCA5A5]">{monitoring.summary.failedPendingToday}</p>
            <p className="mt-2 text-sm text-zinc-500">Anything due today that is still unsent, failed, skipped, or waiting in queue.</p>
          </AdminCard>
          <AdminCard>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Last report cron</p>
            <p className="mt-4 text-lg font-semibold text-white">{formatAdminDate(monitoring.cron.lastRunAt)}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <AdminBadge label={monitoring.cron.lastRunStatus} tone={getStatusTone(monitoring.cron.lastRunStatus)} />
              <AdminBadge label={`${monitoring.cron.lastRunProcessed} items`} tone="neutral" mono />
            </div>
          </AdminCard>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr,1fr]">
          <AdminSeriesChart
            title="Emails sent vs failed"
            description="Daily queue activity for scheduled report emails over the last 7 days."
            points={monitoring.chart}
            series={[
              { key: "scheduled", label: "Scheduled", tone: "blue" },
              { key: "sent", label: "Sent", tone: "green" },
              { key: "failed", label: "Failed", tone: "red" }
            ]}
          />

          <AdminCard>
            <form action="/admin/emails" className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
              <div>
                <label htmlFor="monitorUser" className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                  User / Website
                </label>
                <input
                  id="monitorUser"
                  name="monitorUser"
                  defaultValue={monitoring.filters.user}
                  placeholder="email, user id, or website"
                  className="mt-2 w-full rounded-2xl border border-[#27272A] bg-[#0D0D0D] px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500"
                />
              </div>
              <div>
                <label htmlFor="monitorStatus" className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                  Status
                </label>
                <select
                  id="monitorStatus"
                  name="monitorStatus"
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
                <label htmlFor="monitorDate" className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                  Last attempt date
                </label>
                <input
                  id="monitorDate"
                  name="monitorDate"
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
                <a href="/admin/emails" className="text-sm text-zinc-400 underline-offset-4 hover:text-white hover:underline">
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
                      <th className="px-4 py-3 font-medium">User</th>
                      <th className="px-4 py-3 font-medium">Website</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Reason</th>
                      <th className="px-4 py-3 font-medium">Last Attempt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monitoring.rows.map((row, index) => (
                      <tr key={row.id} className={`${index % 2 === 0 ? "bg-[#101010]" : "bg-[#141414]"} align-top hover:bg-[#181818]`}>
                        <td className="px-4 py-4">
                          <p className="break-all font-medium text-white">{row.email}</p>
                          <p className="mt-1 font-mono text-xs text-zinc-500">{row.userId}</p>
                          <p className="mt-2 text-xs uppercase tracking-[0.16em] text-[#86EFAC]">{row.planLabel}</p>
                        </td>
                        <td className="px-4 py-4 text-zinc-300">
                          <p className="font-medium text-white">{row.websiteLabel}</p>
                          <p className="mt-1 break-all text-xs text-zinc-500">{row.websiteUrl}</p>
                        </td>
                        <td className="px-4 py-4">
                          <AdminBadge label={row.status} tone={getStatusTone(row.status)} />
                        </td>
                        <td className="px-4 py-4 text-zinc-300">
                          <p>{row.reason}</p>
                          {row.lastError ? <p className="mt-2 text-xs leading-5 text-[#FCA5A5]">{row.lastError}</p> : null}
                        </td>
                        <td className="px-4 py-4 font-mono text-xs text-zinc-500">{formatAdminDate(row.lastAttempt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </AdminCard>
          ) : (
            <AdminEmptyState
              title="No failed or pending report emails"
              description="Every scheduled PDF report email that is due right now has either been sent or there is no backlog matching the selected filters."
            />
          )}
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">Delivery Log</p>
        <h2 className="text-2xl font-semibold text-white">Raw Resend activity</h2>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminCard>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Emails sent today</p>
          <p className="mt-4 text-3xl font-semibold text-white">{data.stats.sentToday}</p>
        </AdminCard>
        <AdminCard>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Emails sent this month</p>
          <p className="mt-4 text-3xl font-semibold text-white">{data.stats.sentThisMonth}</p>
        </AdminCard>
        <AdminCard>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Failed this month</p>
          <p className="mt-4 text-3xl font-semibold text-[#FCA5A5]">{data.stats.failedThisMonth}</p>
        </AdminCard>
        <AdminCard>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Most active recipient</p>
          <p className="mt-4 break-all text-lg font-semibold text-white">{data.stats.mostActiveRecipient}</p>
        </AdminCard>
      </div>

      <div className="mt-6">
        {data.rows.length ? (
          <AdminCard className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[#0D0D0D] text-zinc-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">To</th>
                    <th className="px-4 py-3 font-medium">Subject</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Sent at</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Website</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row, index) => (
                    <tr key={row.id} className={`${index % 2 === 0 ? "bg-[#101010]" : "bg-[#141414]"} hover:bg-[#181818]`}>
                      <td className="px-4 py-4 text-zinc-200">{row.to}</td>
                      <td className="px-4 py-4 text-zinc-300">{row.subject}</td>
                      <td className="px-4 py-4 text-zinc-300">{row.type}</td>
                      <td className="px-4 py-4 font-mono text-xs text-zinc-500">{formatAdminDate(row.sentAt)}</td>
                      <td className="px-4 py-4">
                        <AdminBadge label={row.status} tone={row.status === "sent" ? "green" : "red"} />
                      </td>
                      <td className="px-4 py-4 text-zinc-300">
                        {row.websiteLabel}
                        {row.errorMessage ? (
                          <p className="mt-1 font-mono text-xs text-[#FCA5A5]">{row.errorMessage}</p>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-5 pb-5">
              <AdminPagination
                page={data.page}
                totalPages={data.totalPages}
                buildHref={(nextPage) =>
                  buildHref(nextPage, {
                    user: monitoring.filters.user,
                    status: monitoring.filters.status,
                    date: monitoring.filters.date
                  })
                }
              />
            </div>
          </AdminCard>
        ) : (
          <AdminEmptyState
            title="No email logs yet"
            description="Email activity will appear here as soon as Resend deliveries are logged into the new email_logs table."
          />
        )}
      </div>
    </div>
  );
}
