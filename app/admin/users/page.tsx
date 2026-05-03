import { AdminUserPlanControl } from "@/components/admin/admin-user-plan-control";
import { AdminCard } from "@/components/admin/admin-card";
import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminErrorNotice } from "@/components/admin/admin-error-notice";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { getAdminCurrentPlanLabel } from "@/lib/admin/user-plan";
import { requireAdminPageAccess } from "@/lib/admin/auth";
import { getAdminUsersData } from "@/lib/admin/data";
import {
  formatAdminDate,
  getPlanTone,
  getRowIndicatorColor,
  getStatusLabel,
  getStatusTone,
  parsePageParam,
  parseTextParam
} from "@/lib/admin/format";

import { runAdminUserAction } from "./actions";

function buildHref(params: URLSearchParams, page: number) {
  const next = new URLSearchParams(params);
  next.set("page", String(page));
  return `/admin/users?${next.toString()}`;
}

function formatUserLocation(row: { city: string | null; country: string | null }) {
  if (row.city && row.country) {
    return `${row.city}, ${row.country}`;
  }

  if (row.country) {
    return row.country;
  }

  return "Unknown";
}

export default async function AdminUsersPage({
  searchParams
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  requireAdminPageAccess();

  const search = parseTextParam(searchParams?.search);
  const filter = parseTextParam(searchParams?.filter) || "all";
  const sort = parseTextParam(searchParams?.sort) || "newest";
  const page = parsePageParam(searchParams?.page, 1);
  const actionStatus = parseTextParam(searchParams?.actionStatus);
  const actionMessage = parseTextParam(searchParams?.actionMessage);
  const data = await getAdminUsersData({ search, filter, sort, page });
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (filter) params.set("filter", filter);
  if (sort) params.set("sort", sort);

  return (
    <div>
      <AdminPageHeader
        title="Users"
        description="Search every account, inspect subscription state, and review websites, reports, and trial progress for each customer."
        actions={
          <a
            href={`/admin/users/export?${params.toString()}`}
            className="rounded-full border border-[#1D4ED8] bg-[#172554] px-4 py-2 text-sm font-medium text-[#BFDBFE]"
          >
            Export CSV
          </a>
        }
      />

      <AdminErrorNotice message={data.error} />

      {actionMessage ? (
        <div
          className={`mb-6 rounded-2xl border px-4 py-3 text-sm ${
            actionStatus === "success"
              ? "border-[#14532D] bg-[#052E16] text-[#86EFAC]"
              : "border-[#7F1D1D] bg-[#450A0A] text-[#FCA5A5]"
          }`}
        >
          {actionMessage}
        </div>
      ) : null}

      <AdminCard>
        <form className="grid gap-3 lg:grid-cols-[2fr_1fr_1fr_auto]">
          <input
            type="text"
            name="search"
            defaultValue={search}
            placeholder="Search by email or name"
            className="rounded-2xl border border-[#2A2A2A] bg-[#0B0B0B] px-4 py-3 text-sm text-white outline-none focus:border-[#22C55E]"
          />
          <select
            name="filter"
            defaultValue={filter}
            className="rounded-2xl border border-[#2A2A2A] bg-[#0B0B0B] px-4 py-3 text-sm text-white outline-none focus:border-[#22C55E]"
          >
            <option value="all">All</option>
            <option value="trial">Trial</option>
            <option value="paid">Paid</option>
            <option value="expired">Expired</option>
            <option value="free">Free</option>
          </select>
          <select
            name="sort"
            defaultValue={sort}
            className="rounded-2xl border border-[#2A2A2A] bg-[#0B0B0B] px-4 py-3 text-sm text-white outline-none focus:border-[#22C55E]"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="plan">Plan</option>
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
                    <th className="px-4 py-3 font-medium">User</th>
                    <th className="px-4 py-3 font-medium">Plan</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Trial ends</th>
                    <th className="px-4 py-3 font-medium">Websites</th>
                    <th className="px-4 py-3 font-medium">Location</th>
                    <th className="px-4 py-3 font-medium">IP Address</th>
                    <th className="px-4 py-3 font-medium">Joined</th>
                    <th className="px-4 py-3 font-medium">Last active</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row, index) => {
                    const planTone = getPlanTone(row.plan);
                    const statusTone = getStatusTone(row.state);

                    return (
                      <tr
                        key={row.id}
                        className={`${index % 2 === 0 ? "bg-[#101010]" : "bg-[#141414]"} align-top hover:bg-[#181818]`}
                      >
                        <td className="px-4 py-4">
                          <div className="flex items-start gap-3">
                            <span
                              className="mt-1 h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: getRowIndicatorColor(row.state) }}
                            />
                            <div>
                              <p className="font-medium text-white">{row.email}</p>
                              <p className="mt-1 text-sm text-zinc-500">{row.name}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className="inline-flex rounded-full border px-2.5 py-1 text-xs font-medium"
                            style={{
                              background: planTone.background,
                              color: planTone.color,
                              borderColor: planTone.border
                            }}
                          >
                            {getAdminCurrentPlanLabel(row.plan, row.billingCycle)}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className="inline-flex rounded-full border px-2.5 py-1 text-xs font-medium"
                            style={{
                              background: statusTone.background,
                              color: statusTone.color,
                              borderColor: statusTone.border
                            }}
                          >
                            {getStatusLabel(row.state)}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-zinc-300">
                          {row.trialEndsAt ? formatAdminDate(row.trialEndsAt) : "N/A"}
                        </td>
                        <td className="px-4 py-4 text-zinc-300">{row.websitesCount}</td>
                        <td className="px-4 py-4 text-zinc-300">{formatUserLocation(row)}</td>
                        <td className="px-4 py-4 font-mono text-zinc-300">{row.ipAddress ?? "—"}</td>
                        <td className="px-4 py-4 text-zinc-300">{formatAdminDate(row.joinedAt)}</td>
                        <td className="px-4 py-4 text-zinc-300">
                          {row.lastActiveAt ? formatAdminDate(row.lastActiveAt) : "N/A"}
                        </td>
                        <td className="px-4 py-4">
                          <details className="rounded-2xl border border-[#232323] bg-[#111111] p-3">
                            <summary className="cursor-pointer list-none text-sm font-medium text-white">
                              View
                            </summary>
                            <div className="mt-3 space-y-3 text-sm text-zinc-300">
                              <div>
                                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Websites</p>
                                <div className="mt-2 space-y-2">
                                  {row.websites.length ? (
                                    row.websites.map((website) => (
                                      <div key={website.id} className="rounded-xl border border-[#1F1F1F] bg-[#0D0D0D] p-3">
                                        <p className="font-medium text-white">{website.label}</p>
                                        <p className="mt-1 break-all text-xs font-mono text-zinc-500">{website.url}</p>
                                      </div>
                                    ))
                                  ) : (
                                    <p className="text-zinc-500">No websites added yet.</p>
                                  )}
                                </div>
                              </div>
                              <div className="grid gap-3 sm:grid-cols-2">
                                <div>
                                  <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Subscription</p>
                                  <p className="mt-2 text-zinc-300">
                                    {row.subscriptionStatus ?? "inactive"} {row.billingCycle ? `· ${row.billingCycle}` : ""}
                                  </p>
                                  <p className="mt-1 text-zinc-500">
                                    {row.subscriptionPrice ? `$${row.subscriptionPrice}` : "$0"} · next billing{" "}
                                    {row.nextBillingDate ? formatAdminDate(row.nextBillingDate) : "N/A"}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Activity</p>
                                  <p className="mt-2 text-zinc-300">Last scan: {row.lastScanAt ? formatAdminDate(row.lastScanAt) : "N/A"}</p>
                                  <p className="mt-1 text-zinc-500">Reports sent: {row.reportsSentCount}</p>
                                  <p className="mt-1 text-zinc-500">Trial state: {getStatusLabel(row.state)}</p>
                                </div>
                              </div>
                              <div>
                                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Plan Management</p>
                                <div className="mt-3">
                                  <AdminUserPlanControl
                                    userId={row.id}
                                    plan={row.plan}
                                    billingCycle={row.billingCycle}
                                    planOverride={row.planOverride}
                                    planOverrideCountsAsRevenue={row.planOverrideCountsAsRevenue}
                                  />
                                </div>
                              </div>
                              <div className="text-xs text-zinc-500">Impersonate (future)</div>
                              <div className="border-t border-[#232323] pt-3">
                                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Account Controls</p>
                                <div className="mt-3 grid gap-3">
                                  <form action={runAdminUserAction}>
                                    <input type="hidden" name="actionType" value="disable" />
                                    <input type="hidden" name="userId" value={row.id} />
                                    <input type="hidden" name="page" value={String(page)} />
                                    <input type="hidden" name="search" value={search} />
                                    <input type="hidden" name="filter" value={filter} />
                                    <input type="hidden" name="sort" value={sort} />
                                    <button
                                      type="submit"
                                      className="w-full rounded-xl border border-[#92400E] bg-[#451A03] px-3 py-2 text-xs font-semibold text-[#FCD34D]"
                                    >
                                      Disable User
                                    </button>
                                  </form>
                                  <form action={runAdminUserAction} className="rounded-xl border border-[#7F1D1D] bg-[#1A0A0A] p-3">
                                    <input type="hidden" name="actionType" value="delete" />
                                    <input type="hidden" name="userId" value={row.id} />
                                    <input type="hidden" name="page" value={String(page)} />
                                    <input type="hidden" name="search" value={search} />
                                    <input type="hidden" name="filter" value={filter} />
                                    <input type="hidden" name="sort" value={sort} />
                                    <label className="text-xs font-medium text-[#FCA5A5]" htmlFor={`confirm-delete-${row.id}`}>
                                      Type DELETE to remove this user and all database records.
                                    </label>
                                    <input
                                      id={`confirm-delete-${row.id}`}
                                      name="confirmation"
                                      className="mt-2 w-full rounded-lg border border-[#7F1D1D] bg-[#0D0D0D] px-3 py-2 text-xs text-white outline-none"
                                      placeholder="DELETE"
                                    />
                                    <button
                                      type="submit"
                                      className="mt-2 w-full rounded-xl border border-[#991B1B] bg-[#7F1D1D] px-3 py-2 text-xs font-semibold text-white"
                                    >
                                      Delete User Data
                                    </button>
                                  </form>
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
            title="No users matched your filters"
            description="Try widening the search, switching the status filter, or sorting by newest again."
          />
        )}
      </div>
    </div>
  );
}
