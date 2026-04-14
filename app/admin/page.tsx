import { AdminCard } from "@/components/admin/admin-card";
import { AdminErrorNotice } from "@/components/admin/admin-error-notice";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { requireAdminPageAccess } from "@/lib/admin/auth";
import { getAdminOverviewData } from "@/lib/admin/data";
import { formatAdminDate } from "@/lib/admin/format";

function toneClasses(tone: "neutral" | "green" | "blue" | "amber" | "red") {
  if (tone === "green") return "border-[#14532D] bg-[#052E16] text-[#86EFAC]";
  if (tone === "blue") return "border-[#1D4ED8] bg-[#172554] text-[#93C5FD]";
  if (tone === "amber") return "border-[#78350F] bg-[#451A03] text-[#FCD34D]";
  if (tone === "red") return "border-[#7F1D1D] bg-[#450A0A] text-[#FCA5A5]";
  return "border-[#222222] bg-[#141414] text-zinc-200";
}

export default async function AdminOverviewPage() {
  requireAdminPageAccess();
  const data = await getAdminOverviewData();

  return (
    <div>
      <AdminPageHeader
        title="Platform Overview"
        description="A live snapshot of user growth, trial activity, revenue, cron health, and the latest platform events."
      />

      <AdminErrorNotice message={data.error} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {data.stats.map((item) => (
          <AdminCard key={item.label}>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">{item.label}</p>
            <p className="mt-4 text-3xl font-semibold text-white">{item.value}</p>
            <div className={`mt-4 inline-flex rounded-full border px-2.5 py-1 text-xs ${toneClasses(item.tone)}`}>
              Live
            </div>
          </AdminCard>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <AdminCard>
          <h2 className="text-lg font-semibold text-white">Revenue Snapshot</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {data.revenue.map((item) => (
              <div key={item.label} className="rounded-2xl border border-[#1F1F1F] bg-[#0D0D0D] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">{item.label}</p>
                <p className="mt-3 text-2xl font-semibold text-white">{item.value}</p>
                <p className="mt-2 text-sm leading-6 text-zinc-400">{item.note}</p>
              </div>
            ))}
          </div>
        </AdminCard>

        <AdminCard>
          <h2 className="text-lg font-semibold text-white">System Health</h2>
          <div className="mt-5 space-y-3">
            {data.health.map((item) => (
              <div key={item.label} className="rounded-2xl border border-[#1F1F1F] bg-[#0D0D0D] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-zinc-200">{item.label}</p>
                    <p className="mt-2 font-mono text-sm text-white">
                      {item.value.includes("T") ? formatAdminDate(item.value) : item.value}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-zinc-400">{item.note}</p>
                  </div>
                  <span className={`rounded-full border px-2.5 py-1 text-xs ${toneClasses(item.tone)}`}>
                    {item.tone === "green" ? "Healthy" : item.tone === "red" ? "Needs attention" : "Monitor"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </AdminCard>
      </div>

      <div className="mt-6">
        <AdminCard>
          <h2 className="text-lg font-semibold text-white">Recent Activity Feed</h2>
          <p className="mt-1 text-sm text-zinc-400">The latest signups, reports, scan failures, and trial/payment events.</p>

          <div className="mt-5 overflow-hidden rounded-2xl border border-[#1F1F1F]">
            {data.activity.length ? (
              <div className="divide-y divide-[#1F1F1F]">
                {data.activity.map((item, index) => (
                  <div
                    key={item.id}
                    className={`flex flex-col gap-2 px-4 py-4 sm:flex-row sm:items-start sm:justify-between ${
                      index % 2 === 0 ? "bg-[#0F0F0F]" : "bg-[#131313]"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">{item.type}</p>
                      <p className="mt-1 text-sm text-zinc-300">{item.title}</p>
                      <p className="mt-1 text-sm leading-6 text-zinc-500">{item.detail}</p>
                    </div>
                    <div className="shrink-0 text-xs font-mono text-zinc-500">{formatAdminDate(item.timestamp)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-6 py-10 text-center text-sm text-zinc-400">No recent activity available yet.</div>
            )}
          </div>
        </AdminCard>
      </div>
    </div>
  );
}
