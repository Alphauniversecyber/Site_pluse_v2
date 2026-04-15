import "server-only";

import { startOfMonthIso } from "@/lib/admin/format";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import type { BillingCycle, SubscriptionStatus } from "@/types";

type AdminSubscriptionRow = {
  id: string;
  user_id: string;
  email: string;
  plan_name: string;
  plan_tier: "starter" | "agency";
  billing_interval: BillingCycle;
  original_price: number | string;
  sale_price: number | string;
  paddle_subscription_id: string;
  status: SubscriptionStatus;
  next_billing_date: string | null;
  last_payment_date: string | null;
  created_at: string;
  updated_at: string;
};

type AdminPaymentLogRow = {
  id: string;
  subscription_id: string | null;
  user_id: string | null;
  user_email: string;
  plan_name: string | null;
  event_type: string;
  status: string;
  error_message: string | null;
  amount: number | string | null;
  paddle_event_id: string | null;
  paddle_subscription_id: string | null;
  timestamp: string;
  created_at: string;
};

export type AdminBillingMonitoringData = {
  search: string;
  summary: {
    paidUsers: number;
    activeSubscriptions: number;
    cancelledSubscriptions: number;
    paymentFailures: number;
    pendingWebhookEvents: number;
    emailsThisMonth: number;
    failedEmailsThisMonth: number;
  };
  webhookProcessor: {
    lastRunAt: string | null;
    lastRunStatus: string;
    lastRunProcessed: number;
  };
  subscribers: Array<{
    id: string;
    email: string;
    planName: string;
    billingInterval: BillingCycle;
    originalPrice: number;
    salePrice: number;
    status: SubscriptionStatus;
    nextBillingDate: string | null;
    lastPaymentDate: string | null;
    paddleSubscriptionId: string;
    createdAt: string;
    updatedAt: string;
  }>;
  paymentLogs: Array<{
    id: string;
    email: string;
    planName: string | null;
    eventType: string;
    status: string;
    amount: number | null;
    errorMessage: string | null;
    timestamp: string;
    paddleSubscriptionId: string | null;
  }>;
  error: string | null;
};

const ACTIVE_SUBSCRIPTION_STATUSES = new Set<SubscriptionStatus>([
  "active",
  "trialing",
  "past_due",
  "paused"
]);

function toNumber(value: number | string | null | undefined) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

export async function getAdminBillingMonitoringData(search = ""): Promise<AdminBillingMonitoringData> {
  const admin = createSupabaseAdminClient();
  const searchValue = search.trim().toLowerCase();
  const monthIso = startOfMonthIso();

  try {
    const [subscriptionsResult, paymentLogsResult, webhookEventsResult, cronLogsResult, emailLogsResult] =
      await Promise.all([
        admin
          .from("subscriptions")
          .select(
            "id,user_id,email,plan_name,plan_tier,billing_interval,original_price,sale_price,paddle_subscription_id,status,next_billing_date,last_payment_date,created_at,updated_at"
          )
          .order("updated_at", { ascending: false }),
        admin
          .from("payment_logs")
          .select(
            "id,subscription_id,user_id,user_email,plan_name,event_type,status,error_message,amount,paddle_event_id,paddle_subscription_id,timestamp,created_at"
          )
          .order("timestamp", { ascending: false })
          .limit(250),
        admin
          .from("paddle_webhook_events")
          .select("id,status,next_retry_at", { count: "exact" })
          .in("status", ["pending", "failed"]),
        admin
          .from("cron_logs")
          .select("started_at,status,items_processed")
          .eq("cron_name", "process-paddle-webhooks")
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle<{
            started_at: string;
            status: string;
            items_processed: number | null;
          }>(),
        admin
          .from("email_logs")
          .select("status,sent_at")
          .gte("sent_at", monthIso)
          .limit(1000)
      ]);

    if (subscriptionsResult.error) {
      throw new Error(subscriptionsResult.error.message);
    }

    if (paymentLogsResult.error) {
      throw new Error(paymentLogsResult.error.message);
    }

    if (webhookEventsResult.error) {
      throw new Error(webhookEventsResult.error.message);
    }

    if (cronLogsResult.error) {
      throw new Error(cronLogsResult.error.message);
    }

    if (emailLogsResult.error) {
      throw new Error(emailLogsResult.error.message);
    }

    const subscriptionRows = (subscriptionsResult.data ?? []) as AdminSubscriptionRow[];
    const paymentLogRows = (paymentLogsResult.data ?? []) as AdminPaymentLogRow[];
    const emailLogRows = (emailLogsResult.data ?? []) as Array<{
      status: string;
      sent_at: string;
    }>;
    const filteredSubscriptions = subscriptionRows.filter((row) =>
      !searchValue || row.email.toLowerCase().includes(searchValue)
    );
    const filteredPaymentLogs = paymentLogRows.filter((row) =>
      !searchValue || row.user_email.toLowerCase().includes(searchValue)
    );

    return {
      search,
      summary: {
        paidUsers: new Set(
          subscriptionRows
            .filter((row) => ACTIVE_SUBSCRIPTION_STATUSES.has(row.status))
            .map((row) => row.user_id)
        ).size,
        activeSubscriptions: subscriptionRows.filter((row) =>
          ACTIVE_SUBSCRIPTION_STATUSES.has(row.status)
        ).length,
        cancelledSubscriptions: subscriptionRows.filter((row) => row.status === "cancelled").length,
        paymentFailures: paymentLogRows.filter((row) => row.status === "failed").length,
        pendingWebhookEvents: webhookEventsResult.count ?? 0,
        emailsThisMonth: emailLogRows.length,
        failedEmailsThisMonth: emailLogRows.filter((row) => row.status === "failed").length
      },
      webhookProcessor: {
        lastRunAt: cronLogsResult.data?.started_at ?? null,
        lastRunStatus: cronLogsResult.data?.status ?? "never",
        lastRunProcessed: cronLogsResult.data?.items_processed ?? 0
      },
      subscribers: filteredSubscriptions.map((row) => ({
        id: row.id,
        email: row.email,
        planName: row.plan_name,
        billingInterval: row.billing_interval,
        originalPrice: toNumber(row.original_price),
        salePrice: toNumber(row.sale_price),
        status: row.status,
        nextBillingDate: row.next_billing_date,
        lastPaymentDate: row.last_payment_date,
        paddleSubscriptionId: row.paddle_subscription_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      })),
      paymentLogs: filteredPaymentLogs.map((row) => ({
        id: row.id,
        email: row.user_email,
        planName: row.plan_name,
        eventType: row.event_type,
        status: row.status,
        amount: row.amount === null ? null : toNumber(row.amount),
        errorMessage: row.error_message,
        timestamp: row.timestamp,
        paddleSubscriptionId: row.paddle_subscription_id
      })),
      error: null
    };
  } catch (error) {
    return {
      search,
      summary: {
        paidUsers: 0,
        activeSubscriptions: 0,
        cancelledSubscriptions: 0,
        paymentFailures: 0,
        pendingWebhookEvents: 0,
        emailsThisMonth: 0,
        failedEmailsThisMonth: 0
      },
      webhookProcessor: {
        lastRunAt: null,
        lastRunStatus: "never",
        lastRunProcessed: 0
      },
      subscribers: [],
      paymentLogs: [],
      error: error instanceof Error ? error.message : "Unable to load billing monitoring."
    };
  }
}
