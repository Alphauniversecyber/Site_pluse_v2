"use client";

import { useEffect, useMemo, useState } from "react";

import {
  AdminUserPlanControl,
  type AdminUserPlanUpdateResponse
} from "@/components/admin/admin-user-plan-control";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import {
  formatAdminDate,
  formatCurrency,
  getPlanTone,
  getRowIndicatorColor,
  getStatusLabel,
  getStatusTone,
  type AdminUserState
} from "@/lib/admin/format";
import { getAdminDisplayedPlanLabel } from "@/lib/admin/user-plan";
import type { AdminUsersPageData } from "@/lib/admin/data";

import { runAdminUserAction } from "./actions";

type AdminUserRow = AdminUsersPageData["rows"][number];

type AdminUsersTableProps = {
  rows: AdminUserRow[];
  page: number;
  search: string;
  filter: string;
  sort: string;
};

function formatUserLocation(row: { city: string | null; country: string | null; region: string | null }) {
  if (row.city && row.country) {
    return `${row.city}, ${row.country}`;
  }

  if (row.region && row.country) {
    return `${row.region}, ${row.country}`;
  }

  if (row.country) {
    return row.country;
  }

  return "Unknown";
}

function getPlanBadgeStyle(row: Pick<AdminUserRow, "plan" | "billingCycle" | "state">) {
  if (row.state === "trial" || row.state === "expired") {
    return {
      background: "#172554",
      color: "#93C5FD",
      border: "#1D4ED8"
    };
  }

  return getPlanTone(row.plan);
}

function getSubscriptionStatusLabel(row: Pick<AdminUserRow, "state">) {
  if (row.state === "paid") {
    return "Active";
  }

  return getStatusLabel(row.state);
}

function createUpdatedUserRow(
  row: AdminUserRow,
  response: AdminUserPlanUpdateResponse
): AdminUserRow {
  return {
    ...row,
    plan: response.plan,
    planLabel: response.currentPlanLabel,
    state: response.state,
    billingCycle: response.billingCycle,
    subscriptionStatus: response.subscriptionStatus,
    subscriptionPrice: response.subscriptionPrice,
    nextBillingDate: response.nextBillingDate,
    trialEndsAt: response.trialEndsAt,
    planOverride: response.planOverride,
    planOverrideCountsAsRevenue: response.planOverrideCountsAsRevenue
  };
}

function UserDetailsDialog({
  user,
  open,
  onOpenChange,
  onUserUpdated,
  page,
  search,
  filter,
  sort
}: {
  user: AdminUserRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUserUpdated: (response: AdminUserPlanUpdateResponse) => void;
  page: number;
  search: string;
  filter: string;
  sort: string;
}) {
  const planTone = useMemo(() => (user ? getPlanBadgeStyle(user) : null), [user]);
  const statusTone = useMemo(
    () => (user ? getStatusTone(user.state as AdminUserState) : null),
    [user]
  );

  if (!user) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="left-0 top-0 flex h-screen w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-0 bg-[#101010] p-0 sm:left-[50%] sm:top-[50%] sm:h-auto sm:max-h-[90vh] sm:w-full sm:max-w-5xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:border sm:border-[#1F1F1F] sm:bg-[#111111]">
        <DialogHeader className="border-b border-[#1F1F1F] px-5 py-5 sm:px-6">
          <DialogTitle className="pr-10 text-white">User Details</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Review account state, website activity, and plan controls for this customer.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
          <div className="space-y-6">
            <section className="rounded-3xl border border-[#232323] bg-[#0D0D0D] p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xl font-semibold text-white">{user.email}</p>
                  <p className="mt-1 text-sm text-zinc-400">{user.name}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {planTone ? (
                    <span
                      className="inline-flex rounded-full border px-2.5 py-1 text-xs font-medium"
                      style={{
                        background: planTone.background,
                        color: planTone.color,
                        borderColor: planTone.border
                      }}
                    >
                      {getAdminDisplayedPlanLabel(user.plan, user.billingCycle, user.state)}
                    </span>
                  ) : null}
                  {statusTone ? (
                    <span
                      className="inline-flex rounded-full border px-2.5 py-1 text-xs font-medium"
                      style={{
                        background: statusTone.background,
                        color: statusTone.color,
                        borderColor: statusTone.border
                      }}
                    >
                      {getSubscriptionStatusLabel(user)}
                    </span>
                  ) : null}
                  {user.planOverride ? (
                    <Badge variant={user.planOverrideCountsAsRevenue ? "success" : "secondary"}>
                      Manual override
                    </Badge>
                  ) : null}
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-2xl border border-[#1F1F1F] bg-[#111111] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Trial ends</p>
                  <p className="mt-2 text-sm text-white">
                    {user.trialEndsAt ? formatAdminDate(user.trialEndsAt) : "N/A"}
                  </p>
                </div>
                <div className="rounded-2xl border border-[#1F1F1F] bg-[#111111] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Joined date</p>
                  <p className="mt-2 text-sm text-white">{formatAdminDate(user.joinedAt)}</p>
                </div>
                <div className="rounded-2xl border border-[#1F1F1F] bg-[#111111] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Last active</p>
                  <p className="mt-2 text-sm text-white">
                    {user.lastActiveAt ? formatAdminDate(user.lastActiveAt) : "N/A"}
                  </p>
                </div>
                <div className="rounded-2xl border border-[#1F1F1F] bg-[#111111] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Location</p>
                  <p className="mt-2 text-sm text-white">{formatUserLocation(user)}</p>
                </div>
                <div className="rounded-2xl border border-[#1F1F1F] bg-[#111111] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">IP address</p>
                  <p className="mt-2 break-all font-mono text-sm text-white">{user.ipAddress ?? "N/A"}</p>
                </div>
                <div className="rounded-2xl border border-[#1F1F1F] bg-[#111111] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Websites</p>
                  <p className="mt-2 text-sm text-white">{user.websitesCount}</p>
                </div>
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-3xl border border-[#232323] bg-[#0D0D0D] p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-white">Website List</p>
                    <p className="mt-1 text-sm text-zinc-500">
                      URLs currently attached to this account.
                    </p>
                  </div>
                  <Badge variant="outline">{user.websitesCount} total</Badge>
                </div>

                <div className="mt-4 space-y-3">
                  {user.websites.length ? (
                    user.websites.map((website) => (
                      <div
                        key={website.id}
                        className="rounded-2xl border border-[#1F1F1F] bg-[#111111] p-4"
                      >
                        <p className="font-medium text-white">{website.label}</p>
                        <p className="mt-1 break-all text-sm text-zinc-400">{website.url}</p>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-[#2A2A2A] bg-[#111111] p-4 text-sm text-zinc-500">
                      No websites added yet.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-[#232323] bg-[#0D0D0D] p-5">
                <p className="text-lg font-semibold text-white">Subscription Details</p>
                <div className="mt-4 grid gap-4">
                  <div className="rounded-2xl border border-[#1F1F1F] bg-[#111111] p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Amount</p>
                    <p className="mt-2 text-sm text-white">
                      {user.subscriptionPrice !== null ? formatCurrency(user.subscriptionPrice) : "N/A"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[#1F1F1F] bg-[#111111] p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Next billing</p>
                    <p className="mt-2 text-sm text-white">
                      {user.nextBillingDate ? formatAdminDate(user.nextBillingDate) : "N/A"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[#1F1F1F] bg-[#111111] p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Reports sent</p>
                    <p className="mt-2 text-sm text-white">{user.reportsSentCount}</p>
                  </div>
                  <div className="rounded-2xl border border-[#1F1F1F] bg-[#111111] p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Last scan</p>
                    <p className="mt-2 text-sm text-white">
                      {user.lastScanAt ? formatAdminDate(user.lastScanAt) : "N/A"}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-[#232323] bg-[#0D0D0D] p-5">
              <div className="mb-4">
                <p className="text-lg font-semibold text-white">Plan Change</p>
                <p className="mt-1 text-sm text-zinc-500">
                  Update the user&apos;s admin-managed plan and optionally record revenue.
                </p>
              </div>

              <AdminUserPlanControl
                userId={user.id}
                plan={user.plan}
                billingCycle={user.billingCycle}
                state={user.state}
                planOverride={user.planOverride}
                planOverrideCountsAsRevenue={user.planOverrideCountsAsRevenue}
                onUpdated={onUserUpdated}
              />
            </section>

            <section className="rounded-3xl border border-[#232323] bg-[#0D0D0D] p-5">
              <p className="text-lg font-semibold text-white">Account Controls</p>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <form action={runAdminUserAction} className="rounded-2xl border border-[#92400E] bg-[#451A03] p-4">
                  <input type="hidden" name="actionType" value="disable" />
                  <input type="hidden" name="userId" value={user.id} />
                  <input type="hidden" name="page" value={String(page)} />
                  <input type="hidden" name="search" value={search} />
                  <input type="hidden" name="filter" value={filter} />
                  <input type="hidden" name="sort" value={sort} />
                  <p className="text-sm text-[#FCD34D]">
                    Disable this account and pause scans, reports, and notifications.
                  </p>
                  <button
                    type="submit"
                    className="mt-4 w-full rounded-xl border border-[#92400E] bg-[#78350F] px-3 py-2 text-sm font-semibold text-[#FEF3C7]"
                  >
                    Disable User
                  </button>
                </form>

                <form action={runAdminUserAction} className="rounded-2xl border border-[#7F1D1D] bg-[#1A0A0A] p-4">
                  <input type="hidden" name="actionType" value="delete" />
                  <input type="hidden" name="userId" value={user.id} />
                  <input type="hidden" name="page" value={String(page)} />
                  <input type="hidden" name="search" value={search} />
                  <input type="hidden" name="filter" value={filter} />
                  <input type="hidden" name="sort" value={sort} />
                  <label className="text-sm font-medium text-[#FCA5A5]" htmlFor={`confirm-delete-${user.id}`}>
                    Type DELETE to remove this user and all database records.
                  </label>
                  <input
                    id={`confirm-delete-${user.id}`}
                    name="confirmation"
                    className="mt-3 w-full rounded-xl border border-[#7F1D1D] bg-[#0D0D0D] px-3 py-2 text-sm text-white outline-none"
                    placeholder="DELETE"
                  />
                  <button
                    type="submit"
                    className="mt-4 w-full rounded-xl border border-[#991B1B] bg-[#7F1D1D] px-3 py-2 text-sm font-semibold text-white"
                  >
                    Delete User Data
                  </button>
                </form>
              </div>
            </section>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function AdminUsersTable({ rows: initialRows, page, search, filter, sort }: AdminUsersTableProps) {
  const [rows, setRows] = useState(initialRows);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

  const selectedUser = useMemo(
    () => rows.find((row) => row.id === selectedUserId) ?? null,
    [rows, selectedUserId]
  );

  function handleUserUpdated(response: AdminUserPlanUpdateResponse) {
    setRows((currentRows) =>
      currentRows.map((row) =>
        row.id === response.userId ? createUpdatedUserRow(row, response) : row
      )
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="min-w-[1150px] w-full text-left text-sm">
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
            {rows.map((row, index) => {
              const planTone = getPlanBadgeStyle(row);
              const statusTone = getStatusTone(row.state as AdminUserState);

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
                      {getAdminDisplayedPlanLabel(row.plan, row.billingCycle, row.state)}
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
                      {getSubscriptionStatusLabel(row)}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-zinc-300">
                    {row.trialEndsAt ? formatAdminDate(row.trialEndsAt) : "N/A"}
                  </td>
                  <td className="px-4 py-4 text-zinc-300">{row.websitesCount}</td>
                  <td className="px-4 py-4 text-zinc-300">{formatUserLocation(row)}</td>
                  <td className="px-4 py-4 font-mono text-zinc-300">{row.ipAddress ?? "N/A"}</td>
                  <td className="px-4 py-4 text-zinc-300">{formatAdminDate(row.joinedAt)}</td>
                  <td className="px-4 py-4 text-zinc-300">
                    {row.lastActiveAt ? formatAdminDate(row.lastActiveAt) : "N/A"}
                  </td>
                  <td className="px-4 py-4">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-[#2A2A2A] bg-[#111111] text-white hover:bg-[#1A1A1A]"
                      onClick={() => setSelectedUserId(row.id)}
                    >
                      View Details
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <UserDetailsDialog
        user={selectedUser}
        open={Boolean(selectedUser)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedUserId(null);
          }
        }}
        onUserUpdated={handleUserUpdated}
        page={page}
        search={search}
        filter={filter}
        sort={sort}
      />
    </>
  );
}
