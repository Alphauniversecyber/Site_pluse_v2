import { AdminBadge } from "@/components/admin/admin-badge";
import { AdminCard } from "@/components/admin/admin-card";
import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminErrorNotice } from "@/components/admin/admin-error-notice";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { requireAdminPageAccess } from "@/lib/admin/auth";
import { getAdminBillingMonitoringData } from "@/lib/admin/billing-monitoring";
import { calculateDiscountPercentage, formatUsdPrice, getPlanPricing, PAID_PLAN_KEYS } from "@/lib/billing";
import { getBillingPlans } from "@/lib/billing-config";
import { formatAdminDate, formatCurrency, parseTextParam } from "@/lib/admin/format";

import { runAdminBillingPricingAction } from "./actions";

function getStatusTone(status: string) {
  if (status === "active" || status === "trialing") {
    return "green" as const;
  }

  if (status === "past_due" || status === "payment_failed") {
    return "amber" as const;
  }

  if (status === "cancelled") {
    return "red" as const;
  }

  if (status === "paused") {
    return "blue" as const;
  }

  return "neutral" as const;
}

function prettifyLabel(value: string) {
  return value.replace(/_/g, " ");
}

export default async function AdminBillingPage({
  searchParams
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  requireAdminPageAccess();
  const search = parseTextParam(searchParams?.search);
  const actionStatus = parseTextParam(searchParams?.actionStatus);
  const actionMessage = parseTextParam(searchParams?.actionMessage);
  const data = await getAdminBillingMonitoringData(search);
  const billingPlans = await getBillingPlans();

  return (
    <div>
      <AdminPageHeader
        title="Billing"
        description="Monitor subscribers, payment outcomes, queued webhooks, and the supporting cron and email systems behind Paddle billing."
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

      <AdminCard className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Plan pricing</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Update original and sale prices here. Customer billing pages automatically calculate the discount percentage from these values.
            </p>
          </div>
          <AdminBadge label="4 paid price points" tone="blue" />
        </div>

        <form action={runAdminBillingPricingAction} className="mt-5 space-y-5">
          <div className="grid gap-4 xl:grid-cols-2">
            {PAID_PLAN_KEYS.flatMap((planKey) =>
              (["monthly", "yearly"] as const).map((billingCycle) => {
                const snapshot = getPlanPricing(planKey, billingCycle, billingPlans);
                const discountPercentage = calculateDiscountPercentage(
                  snapshot.originalPrice,
                  snapshot.salePrice
                );

                return (
                  <div
                    key={`${planKey}-${billingCycle}`}
                    className="rounded-2xl border border-[#1F1F1F] bg-[#0D0D0D] p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">{snapshot.displayName}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-zinc-500">
                          {billingCycle}
                        </p>
                      </div>
                      <AdminBadge
                        label={discountPercentage > 0 ? `${discountPercentage}% off` : "No discount"}
                        tone={discountPercentage > 0 ? "green" : "neutral"}
                      />
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <label className="block">
                        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                          Original price
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          name={`${planKey}_${billingCycle}_original_price`}
                          defaultValue={snapshot.originalPrice}
                          className="mt-2 h-11 w-full rounded-2xl border border-[#222222] bg-[#111111] px-4 text-sm text-white outline-none"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                          Sale price
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          name={`${planKey}_${billingCycle}_sale_price`}
                          defaultValue={snapshot.salePrice}
                          className="mt-2 h-11 w-full rounded-2xl border border-[#222222] bg-[#111111] px-4 text-sm text-white outline-none"
                        />
                      </label>
                    </div>

                    <p className="mt-3 text-sm text-zinc-400">
                      Customer pays {formatUsdPrice(snapshot.salePrice)} per{" "}
                      {billingCycle === "yearly" ? "year" : "month"}
                      {discountPercentage > 0 ? ` instead of ${formatUsdPrice(snapshot.originalPrice)}.` : "."}
                    </p>
                  </div>
                );
              })
            )}
          </div>

          <button
            type="submit"
            className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200"
          >
            Save package pricing
          </button>
        </form>
      </AdminCard>

      <form className="mb-6" action="/admin/billing" method="get">
        <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Search by email
        </label>
        <div className="mt-3 flex flex-col gap-3 md:flex-row">
          <input
            type="search"
            name="search"
            defaultValue={search}
            placeholder="agency@example.com"
            className="h-11 flex-1 rounded-2xl border border-[#222222] bg-[#0B0B0B] px-4 text-sm text-white outline-none placeholder:text-zinc-600"
          />
          <button
            type="submit"
            className="h-11 rounded-2xl bg-white px-5 text-sm font-semibold text-black transition hover:bg-zinc-200"
          >
            Search
          </button>
        </div>
      </form>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminCard>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Paid users</p>
          <p className="mt-4 text-3xl font-semibold text-white">{data.summary.paidUsers}</p>
        </AdminCard>
        <AdminCard>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Active subscriptions</p>
          <p className="mt-4 text-3xl font-semibold text-white">{data.summary.activeSubscriptions}</p>
        </AdminCard>
        <AdminCard>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Cancelled subscriptions</p>
          <p className="mt-4 text-3xl font-semibold text-white">{data.summary.cancelledSubscriptions}</p>
        </AdminCard>
        <AdminCard>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Payment failures</p>
          <p className="mt-4 text-3xl font-semibold text-white">{data.summary.paymentFailures}</p>
        </AdminCard>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <AdminCard>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Queued webhooks</p>
          <div className="mt-4 flex items-center gap-3">
            <p className="text-2xl font-semibold text-white">{data.summary.pendingWebhookEvents}</p>
            <AdminBadge
              label={data.webhookProcessor.lastRunStatus}
              tone={getStatusTone(data.webhookProcessor.lastRunStatus)}
            />
          </div>
          <p className="mt-2 text-sm text-zinc-400">
            Last run: {data.webhookProcessor.lastRunAt ? formatAdminDate(data.webhookProcessor.lastRunAt) : "Never"}
          </p>
        </AdminCard>
        <AdminCard>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Emails this month</p>
          <p className="mt-4 text-2xl font-semibold text-white">{data.summary.emailsThisMonth}</p>
          <p className="mt-2 text-sm text-zinc-400">
            Failed sends: {data.summary.failedEmailsThisMonth}
          </p>
        </AdminCard>
        <AdminCard>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Last webhook cron batch</p>
          <p className="mt-4 text-2xl font-semibold text-white">{data.webhookProcessor.lastRunProcessed}</p>
          <p className="mt-2 text-sm text-zinc-400">Events processed in the last cron execution.</p>
        </AdminCard>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <AdminCard>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">Subscribers</h2>
              <p className="mt-1 text-sm text-zinc-400">
                View plan details, sale pricing, last payment date, and next billing date.
              </p>
            </div>
            <AdminBadge label={`${data.subscribers.length} shown`} tone="blue" />
          </div>

          {data.subscribers.length ? (
            <div className="mt-5 overflow-hidden rounded-2xl border border-[#1F1F1F]">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[#0D0D0D] text-zinc-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium">Plan</th>
                    <th className="px-4 py-3 font-medium">Sale</th>
                    <th className="px-4 py-3 font-medium">Original</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Last payment</th>
                    <th className="px-4 py-3 font-medium">Next billing</th>
                  </tr>
                </thead>
                <tbody>
                  {data.subscribers.map((row, index) => (
                    <tr key={row.id} className={index % 2 === 0 ? "bg-[#101010]" : "bg-[#141414]"}>
                      <td className="px-4 py-4 text-zinc-200">{row.email}</td>
                      <td className="px-4 py-4 text-zinc-300">
                        <div>{row.planName}</div>
                        <div className="mt-1 text-xs uppercase tracking-[0.16em] text-zinc-500">
                          {row.billingInterval}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-zinc-300">{formatCurrency(row.salePrice)}</td>
                      <td className="px-4 py-4 text-zinc-500 line-through">
                        {formatCurrency(row.originalPrice)}
                      </td>
                      <td className="px-4 py-4">
                        <AdminBadge
                          label={prettifyLabel(row.status)}
                          tone={getStatusTone(row.status)}
                        />
                      </td>
                      <td className="px-4 py-4 text-zinc-300">
                        {row.lastPaymentDate ? formatAdminDate(row.lastPaymentDate) : "N/A"}
                      </td>
                      <td className="px-4 py-4 text-zinc-300">
                        {row.nextBillingDate ? formatAdminDate(row.nextBillingDate) : "N/A"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-5">
              <AdminEmptyState
                title="No subscribers found"
                description={
                  search
                    ? "Try a different email search term."
                    : "Paid subscribers will appear here after the first Paddle subscription sync."
                }
              />
            </div>
          )}
        </AdminCard>

        <AdminCard>
          <h2 className="text-lg font-semibold text-white">Payment logs</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Payment success, failure, subscription lifecycle, and webhook processing events.
          </p>

          {data.paymentLogs.length ? (
            <div className="mt-5 space-y-3">
              {data.paymentLogs.slice(0, 20).map((row) => (
                <div key={row.id} className="rounded-2xl border border-[#1F1F1F] bg-[#0D0D0D] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-white">{row.email}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-zinc-500">
                        {row.planName ?? "Unknown plan"}
                      </p>
                    </div>
                    <AdminBadge label={prettifyLabel(row.status)} tone={getStatusTone(row.status)} />
                  </div>
                  <p className="mt-3 text-sm text-zinc-300">{prettifyLabel(row.eventType)}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                    <span>{formatAdminDate(row.timestamp)}</span>
                    <span>{row.amount !== null ? formatCurrency(row.amount) : "No amount"}</span>
                  </div>
                  {row.errorMessage ? (
                    <p className="mt-3 text-sm text-rose-300">{row.errorMessage}</p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-5">
              <AdminEmptyState
                title="No payment logs yet"
                description="Subscription and payment events will appear here once Paddle starts sending webhooks."
              />
            </div>
          )}
        </AdminCard>
      </div>
    </div>
  );
}
