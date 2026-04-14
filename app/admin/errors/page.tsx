import { AdminBadge } from "@/components/admin/admin-badge";
import { AdminCard } from "@/components/admin/admin-card";
import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminErrorNotice } from "@/components/admin/admin-error-notice";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { requireAdminPageAccess } from "@/lib/admin/auth";
import { getAdminErrorsData } from "@/lib/admin/data";
import { formatAdminDate, parsePageParam, parseTextParam } from "@/lib/admin/format";

function buildHref(params: URLSearchParams, page: number) {
  const next = new URLSearchParams(params);
  next.set("page", String(page));
  return `/admin/errors?${next.toString()}`;
}

export default async function AdminErrorsPage({
  searchParams
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  requireAdminPageAccess();

  const type = parseTextParam(searchParams?.type) || "all";
  const range = parseTextParam(searchParams?.range) || "all";
  const page = parsePageParam(searchParams?.page, 1);
  const data = await getAdminErrorsData({ type, range, page });
  const params = new URLSearchParams();
  if (type) params.set("type", type);
  if (range) params.set("range", range);

  return (
    <div>
      <AdminPageHeader
        title="Errors"
        description="Review logged scan, SEO audit, PDF, cron, and email failures with website and user context so you can spot patterns quickly."
      />

      <AdminErrorNotice message={data.error} />

      <AdminCard>
        <form className="grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
          <select
            name="type"
            defaultValue={type}
            className="rounded-2xl border border-[#2A2A2A] bg-[#0B0B0B] px-4 py-3 text-sm text-white outline-none focus:border-[#22C55E]"
          >
            <option value="all">All types</option>
            <option value="scan_failed">scan_failed</option>
            <option value="seo_audit_failed">seo_audit_failed</option>
            <option value="pdf_failed">pdf_failed</option>
            <option value="report_failed">report_failed</option>
            <option value="email_failed">email_failed</option>
            <option value="cron_failed">cron_failed</option>
          </select>
          <select
            name="range"
            defaultValue={range}
            className="rounded-2xl border border-[#2A2A2A] bg-[#0B0B0B] px-4 py-3 text-sm text-white outline-none focus:border-[#22C55E]"
          >
            <option value="all">All time</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
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
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Message</th>
                    <th className="px-4 py-3 font-medium">Website</th>
                    <th className="px-4 py-3 font-medium">User</th>
                    <th className="px-4 py-3 font-medium">Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row, index) => (
                    <tr key={row.id} className={`${index % 2 === 0 ? "bg-[#101010]" : "bg-[#141414]"} align-top hover:bg-[#181818]`}>
                      <td className="px-4 py-4">
                        <AdminBadge label={row.type} tone="red" mono />
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-mono text-xs text-zinc-300">{row.message}</p>
                        {Object.keys(row.context).length ? (
                          <pre className="mt-2 overflow-x-auto rounded-xl border border-[#1F1F1F] bg-[#0D0D0D] p-3 text-xs text-zinc-500">
                            {JSON.stringify(row.context, null, 2)}
                          </pre>
                        ) : null}
                      </td>
                      <td className="px-4 py-4 text-zinc-300">{row.websiteUrl}</td>
                      <td className="px-4 py-4 text-zinc-300">{row.userEmail}</td>
                      <td className="px-4 py-4 font-mono text-xs text-zinc-500">{formatAdminDate(row.createdAt)}</td>
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
            title="No logged errors for this filter"
            description="Once admin_error_logs is populated, this page will show the latest scan, report, email, and cron failures."
          />
        )}
      </div>
    </div>
  );
}
