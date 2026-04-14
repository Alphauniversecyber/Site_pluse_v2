import { AdminBadge } from "@/components/admin/admin-badge";
import { AdminCard } from "@/components/admin/admin-card";
import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminErrorNotice } from "@/components/admin/admin-error-notice";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { requireAdminPageAccess } from "@/lib/admin/auth";
import { getAdminBillingData } from "@/lib/admin/data";
import { formatAdminDate } from "@/lib/admin/format";

export default async function AdminBillingPage() {
  requireAdminPageAccess();
  const data = await getAdminBillingData();

  return (
    <div>
      <AdminPageHeader
        title="Billing"
        description="Track active paid accounts, see which trials are closest to converting, and compare current recurring revenue against recent billing activity."
      />

      <AdminErrorNotice message={data.error} />

      <div className="grid gap-4 md:grid-cols-3">
        <AdminCard>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">MRR</p>
          <p className="mt-4 text-3xl font-semibold text-white">{data.summary.mrr}</p>
        </AdminCard>
        <AdminCard>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Revenue this month</p>
          <p className="mt-4 text-3xl font-semibold text-white">{data.summary.revenueThisMonth}</p>
        </AdminCard>
        <AdminCard>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Revenue last month</p>
          <p className="mt-4 text-3xl font-semibold text-white">{data.summary.revenueLastMonth}</p>
        </AdminCard>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <AdminCard>
          <h2 className="text-lg font-semibold text-white">Paid Users</h2>
          <div className="mt-5 overflow-hidden rounded-2xl border border-[#1F1F1F]">
            {data.paidUsers.length ? (
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[#0D0D0D] text-zinc-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium">Plan</th>
                    <th className="px-4 py-3 font-medium">Amount</th>
                    <th className="px-4 py-3 font-medium">Cycle</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Next billing</th>
                  </tr>
                </thead>
                <tbody>
                  {data.paidUsers.map((row, index) => (
                    <tr key={row.id} className={index % 2 === 0 ? "bg-[#101010]" : "bg-[#141414]"}>
                      <td className="px-4 py-4 text-zinc-200">{row.email}</td>
                      <td className="px-4 py-4 text-zinc-300">{row.planLabel}</td>
                      <td className="px-4 py-4 text-zinc-300">{row.amountLabel}</td>
                      <td className="px-4 py-4 text-zinc-300">{row.billingCycle ?? "N/A"}</td>
                      <td className="px-4 py-4">
                        <AdminBadge label={row.status ?? "inactive"} tone="green" />
                      </td>
                      <td className="px-4 py-4 text-zinc-300">
                        {row.nextBillingDate ? formatAdminDate(row.nextBillingDate) : "N/A"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="px-6 py-10 text-center text-sm text-zinc-400">No active paid users yet.</div>
            )}
          </div>
        </AdminCard>

        <div className="space-y-6">
          <AdminCard>
            <h2 className="text-lg font-semibold text-white">Trial Users</h2>
            <div className="mt-4 space-y-3">
              {data.trialUsers.length ? (
                data.trialUsers.map((row) => (
                  <div key={row.id} className="rounded-2xl border border-[#1F1F1F] bg-[#0D0D0D] p-4">
                    <p className="text-sm font-medium text-white">{row.email}</p>
                    <p className="mt-1 text-sm text-zinc-400">
                      {row.daysRemaining} day{row.daysRemaining !== 1 ? "s" : ""} left
                    </p>
                    <p className="mt-1 font-mono text-xs text-zinc-500">
                      {row.trialEndsAt ? formatAdminDate(row.trialEndsAt) : "N/A"}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-zinc-500">No active trials right now.</p>
              )}
            </div>
          </AdminCard>

          <AdminCard>
            <h2 className="text-lg font-semibold text-white">Expired Trials</h2>
            <div className="mt-4 space-y-3">
              {data.expiredTrials.length ? (
                data.expiredTrials.map((row) => (
                  <div key={row.id} className="rounded-2xl border border-[#1F1F1F] bg-[#0D0D0D] p-4">
                    <p className="text-sm font-medium text-white">{row.email}</p>
                    <p className="mt-1 font-mono text-xs text-zinc-500">
                      {row.trialEndedAt ? formatAdminDate(row.trialEndedAt) : "N/A"}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-zinc-500">No expired trials waiting for follow-up.</p>
              )}
            </div>
          </AdminCard>
        </div>
      </div>
    </div>
  );
}
