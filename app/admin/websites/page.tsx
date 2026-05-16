import { AdminBadge } from "@/components/admin/admin-badge";
import { AdminCard } from "@/components/admin/admin-card";
import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminErrorNotice } from "@/components/admin/admin-error-notice";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { requireAdminPageAccess } from "@/lib/admin/auth";
import { getAdminWebsitesData } from "@/lib/admin/data";
import { formatAdminDate, getHealthTone, parsePageParam, parseTextParam } from "@/lib/admin/format";

function buildHref(params: URLSearchParams, page: number) {
  const next = new URLSearchParams(params);
  next.set("page", String(page));
  return `/admin/websites?${next.toString()}`;
}

export default async function AdminWebsitesPage({
  searchParams
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  requireAdminPageAccess();

  const search = parseTextParam(searchParams?.search);
  const filter = parseTextParam(searchParams?.filter) || "all";
  const page = parsePageParam(searchParams?.page, 1);
  const data = await getAdminWebsitesData({ search, filter, page });
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (filter) params.set("filter", filter);

  return (
    <div>
      <AdminPageHeader
        title="Websites"
        description="Inspect every tracked website, its latest scan state, report activity, and Google connection health."
      />

      <AdminErrorNotice message={data.error} />

      <AdminCard>
        <form className="grid gap-3 lg:grid-cols-[2fr_1fr_auto]">
          <input
            type="text"
            name="search"
            defaultValue={search}
            placeholder="Search by URL, label, or owner email"
            className="rounded-2xl border border-[#2A2A2A] bg-[#0B0B0B] px-4 py-3 text-sm text-white outline-none focus:border-[#22C55E]"
          />
          <select
            name="filter"
            defaultValue={filter}
            className="rounded-2xl border border-[#2A2A2A] bg-[#0B0B0B] px-4 py-3 text-sm text-white outline-none focus:border-[#22C55E]"
          >
            <option value="all">All</option>
            <option value="scan_failed">Scan Failed</option>
            <option value="gsc_connected">GSC Connected</option>
            <option value="ga_connected">GA4 Connected</option>
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
                    <th className="px-4 py-3 font-medium">Health</th>
                    <th className="px-4 py-3 font-medium">Last scan</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Reports</th>
                    <th className="px-4 py-3 font-medium">GSC</th>
                    <th className="px-4 py-3 font-medium">GA4</th>
                    <th className="px-4 py-3 font-medium">Created</th>
                    <th className="px-4 py-3 font-medium">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row, index) => {
                    const tone = getHealthTone(row.healthScore);
                    return (
                      <tr
                        key={row.id}
                        className={`${index % 2 === 0 ? "bg-[#101010]" : "bg-[#141414]"} align-top hover:bg-[#181818]`}
                      >
                        <td className="px-4 py-4">
                          <p className="font-medium text-white">{row.label}</p>
                          <p className="mt-1 break-all font-mono text-xs text-zinc-500">{row.url}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <AdminBadge label={row.isActive ? "active" : "paused"} tone={row.isActive ? "green" : "amber"} />
                            {row.failureReason ? (
                              <span className="rounded-full border border-[#2A2A2A] px-2.5 py-1 text-xs text-zinc-400">
                                {row.failureReason}
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-zinc-300">{row.ownerEmail}</td>
                        <td className="px-4 py-4">
                          <span
                            className="inline-flex rounded-full border px-2.5 py-1 text-xs font-medium"
                            style={{
                              background: tone.background,
                              color: tone.color,
                              borderColor: tone.border
                            }}
                          >
                            {tone.label}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-zinc-300">
                          {row.lastScanAt ? formatAdminDate(row.lastScanAt) : "Never"}
                        </td>
                        <td className="px-4 py-4">
                          <AdminBadge
                            label={row.scanStatus}
                            tone={row.scanStatus === "success" ? "green" : row.scanStatus === "failed" ? "red" : "amber"}
                          />
                        </td>
                        <td className="px-4 py-4 text-zinc-300">{row.reportsSent}</td>
                        <td className="px-4 py-4 text-zinc-300">{row.gscConnected ? "✅" : "❌"}</td>
                        <td className="px-4 py-4 text-zinc-300">{row.gaConnected ? "✅" : "❌"}</td>
                        <td className="px-4 py-4 text-zinc-300">{formatAdminDate(row.createdAt)}</td>
                        <td className="px-4 py-4">
                          <details className="rounded-2xl border border-[#232323] bg-[#111111] p-3">
                            <summary className="cursor-pointer list-none text-sm font-medium text-white">View</summary>
                            <div className="mt-3 space-y-4">
                              <div>
                                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Connection status</p>
                                <div className="mt-2 grid gap-2 text-sm text-zinc-300">
                                  <p>Website state: {row.isActive ? "Active" : "Paused"}</p>
                                  <p>Failure reason: {row.failureReason ?? "None"}</p>
                                  <p>Magic link token: {row.connectionDetails.magicTokenPresent ? "present" : "missing"}</p>
                                  <p>GSC property: {row.connectionDetails.gscProperty ?? "Not connected"}</p>
                                  <p>GA4 property: {row.connectionDetails.gaPropertyId ?? "Not connected"}</p>
                                </div>
                              </div>
                              <div>
                                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Scan history</p>
                                <div className="mt-2 space-y-2">
                                  {row.scanHistory.length ? (
                                    row.scanHistory.map((scan) => (
                                      <div key={scan.id} className="rounded-xl border border-[#1F1F1F] bg-[#0D0D0D] p-3 text-sm">
                                        <div className="flex items-center justify-between gap-3">
                                          <span className="font-mono text-xs text-zinc-500">{formatAdminDate(scan.scanned_at)}</span>
                                          <AdminBadge
                                            label={scan.scan_status}
                                            tone={scan.scan_status === "success" ? "green" : "red"}
                                          />
                                        </div>
                                        {scan.error_message ? (
                                          <p className="mt-2 text-xs font-mono text-[#FCA5A5]">{scan.error_message}</p>
                                        ) : null}
                                      </div>
                                    ))
                                  ) : (
                                    <p className="text-sm text-zinc-500">No scan history yet.</p>
                                  )}
                                </div>
                              </div>
                              <div>
                                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Reports sent</p>
                                <div className="mt-2 space-y-2">
                                  {row.reports.length ? (
                                    row.reports.map((report) => (
                                      <div key={report.id} className="rounded-xl border border-[#1F1F1F] bg-[#0D0D0D] p-3 text-sm">
                                        <p className="text-zinc-300">{report.sent_to_email ?? "No recipient saved"}</p>
                                        <p className="mt-1 font-mono text-xs text-zinc-500">
                                          {report.sent_at ? formatAdminDate(report.sent_at) : "Not sent yet"}
                                        </p>
                                      </div>
                                    ))
                                  ) : (
                                    <p className="text-sm text-zinc-500">No reports available yet.</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </details>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="px-5 pb-5">
              <AdminPagination page={data.page} totalPages={data.totalPages} buildHref={(value) => buildHref(params, value)} />
            </div>
          </AdminCard>
        ) : (
          <AdminEmptyState
            title="No websites matched your filters"
            description="Try a broader search, or remove the connection-status filter to see the rest of the fleet."
          />
        )}
      </div>
    </div>
  );
}
