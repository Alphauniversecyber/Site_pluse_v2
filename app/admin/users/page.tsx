import { AdminCard } from "@/components/admin/admin-card";
import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminErrorNotice } from "@/components/admin/admin-error-notice";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { requireAdminPageAccess } from "@/lib/admin/auth";
import { getAdminUsersData } from "@/lib/admin/data";
import { parsePageParam, parseTextParam } from "@/lib/admin/format";

import { AdminUsersTable } from "./admin-users-table";

function buildHref(params: URLSearchParams, page: number) {
  const next = new URLSearchParams(params);
  next.set("page", String(page));
  return `/admin/users?${next.toString()}`;
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
            <AdminUsersTable
              rows={data.rows}
              page={page}
              search={search}
              filter={filter}
              sort={sort}
            />

            <div className="px-5 pb-5">
              <AdminPagination
                page={data.page}
                totalPages={data.totalPages}
                buildHref={(value) => buildHref(params, value)}
              />
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
