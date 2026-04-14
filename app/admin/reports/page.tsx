import { AdminBadge } from "@/components/admin/admin-badge";
import { AdminCard } from "@/components/admin/admin-card";
import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminErrorNotice } from "@/components/admin/admin-error-notice";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { requireAdminPageAccess } from "@/lib/admin/auth";
import { getAdminReportsData } from "@/lib/admin/data";
import { formatAdminDate, parsePageParam, parseTextParam } from "@/lib/admin/format";

function buildHref(params: URLSearchParams, page: number) {
  const next = new URLSearchParams(params);
  next.set("page", String(page));
  return `/admin/reports?${next.toString()}`;
}

export default async function AdminReportsPage({
  searchParams
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  requireAdminPageAccess();

  const filter = parseTextParam(searchParams?.filter) || "all";
  const page = parsePageParam(searchParams?.page, 1);
  const data = await getAdminReportsData({ filter, page });
  const params = new URLSearchParams();
  if (filter) params.set("filter", filter);

  return (
    <div>
      <AdminPageHeader
        title="Reports"
        description="Audit every generated report, see who received it, and keep an eye on delivery failures across weekly and manual sends."
      />

      <AdminErrorNotice message={data.error} />

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <AdminCard>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Reports sent this month</p>
          <p className="mt-4 text-3xl font-semibold text-white">{data.totals.sentThisMonth}</p>
        </AdminCard>
        <AdminCard>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Failed reports this month</p>
          <p className="mt-4 text-3xl font-semibold text-[#FCA5A5]">{data.totals.failedThisMonth}</p>
        </AdminCard>
      </div>

      <AdminCard>
        <form className="flex flex-wrap items-center gap-3">
          <select
            name="filter"
            defaultValue={filter}
            className="rounded-2xl border border-[#2A2A2A] bg-[#0B0B0B] px-4 py-3 text-sm text-white outline-none focus:border-[#22C55E]"
          >
            <option value="all">All</option>
            <option value="sent">Sent</option>
            <option value="failed">Failed</option>
            <option value="last7">Last 7 days</option>
            <option value="last30">Last 30 days</option>
          </select>
          <button type="submit" className="rounded-2xl bg-[#22C55E] px-4 py-3 text-sm font-semibold text-black">
            Apply
          </button>
        </form>
      </AdminCard>

      <div className="mt-6">
        {data.rows.length ? (
          <AdminCard className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[#0D0D0D] text-zinc-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">Website</th>
                    <th className="px-4 py-3 font-medium">Owner</th>
                    <th className="px-4 py-3 font-medium">Sent to</th>
                    <th className="px-4 py-3 font-medium">Sent at</th>
                    <th className="px-4 py-3 font-medium">PDF</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row, index) => (
                    <tr
                      key={row.id}
                      className={`${index % 2 === 0 ? "bg-[#101010]" : "bg-[#141414]"} hover:bg-[#181818]`}
                    >
                      <td className="px-4 py-4 text-zinc-200">{row.websiteUrl}</td>
                      <td className="px-4 py-4 text-zinc-300">{row.ownerEmail}</td>
                      <td className="px-4 py-4 text-zinc-300">{row.sentTo}</td>
                      <td className="px-4 py-4 text-zinc-300">
                        {row.sentAt ? formatAdminDate(row.sentAt) : formatAdminDate(row.createdAt)}
                      </td>
                      <td className="px-4 py-4 text-zinc-300">{row.hasPdf ? "✅" : "❌"}</td>
                      <td className="px-4 py-4 text-zinc-300">{row.reportType}</td>
                      <td className="px-4 py-4">
                        <AdminBadge label={row.status} tone={row.status === "sent" ? "green" : "red"} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-5 pb-5">
              <AdminPagination page={data.page} totalPages={data.totalPages} buildHref={(value) => buildHref(params, value)} />
            </div>
          </AdminCard>
        ) : (
          <AdminEmptyState
            title="No reports matched this filter"
            description="Try switching back to All, or choose a longer date range to see older report activity."
          />
        )}
      </div>
    </div>
  );
}
