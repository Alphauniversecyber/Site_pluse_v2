import { AdminBadge } from "@/components/admin/admin-badge";
import { AdminCard } from "@/components/admin/admin-card";
import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminErrorNotice } from "@/components/admin/admin-error-notice";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { requireAdminPageAccess } from "@/lib/admin/auth";
import { getAdminEmailsData } from "@/lib/admin/data";
import { formatAdminDate, parsePageParam } from "@/lib/admin/format";

function buildHref(page: number) {
  return `/admin/emails?page=${page}`;
}

export default async function AdminEmailsPage({
  searchParams
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  requireAdminPageAccess();

  const page = parsePageParam(searchParams?.page, 1);
  const data = await getAdminEmailsData({ page });

  return (
    <div>
      <AdminPageHeader
        title="Emails"
        description="Review every email sent through Resend, including failed deliveries, the most active recipients, and per-website volume."
      />

      <AdminErrorNotice message={data.error} />

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
              <AdminPagination page={data.page} totalPages={data.totalPages} buildHref={buildHref} />
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
