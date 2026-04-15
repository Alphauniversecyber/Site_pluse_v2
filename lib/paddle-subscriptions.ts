import "server-only";

import { randomUUID } from "node:crypto";

import {
  logAdminError,
  logBillingEvent
} from "@/lib/admin/logging";
import { getCronBatchLimit, createCronExecutionGuard } from "@/lib/cron";
import {
  getPaddleSubscription,
  getPaddleTransaction,
  mapPaddleStatus,
  parsePaddleSelection,
  resolveSelectionFromPriceId,
  type PaddleSubscription,
  type PaddleTransaction
} from "@/lib/paddle";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import type { BillingCycle, SubscriptionStatus, UserProfile } from "@/types";

type PaddleWebhookEventRecord = {
  id: string;
  paddle_event_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  status: "pending" | "processing" | "processed" | "failed";
  retry_count: number;
  next_retry_at: string;
  processed_at: string | null;
  last_error: string | null;
  created_at: string;
};

type SubscriptionRow = {
  id: string;
  user_id: string;
  email: string;
  plan_name: string;
  plan_tier: "starter" | "agency";
  billing_interval: BillingCycle;
  original_price: number;
  sale_price: number;
  paddle_customer_id: string | null;
  paddle_subscription_id: string;
  status: SubscriptionStatus;
  next_billing_date: string | null;
  last_payment_date: string | null;
  created_at: string;
  updated_at: string;
};

type ResolvedSelection = {
  plan: "starter" | "agency";
  billingCycle: BillingCycle;
  planName: string;
  originalPrice: number;
  salePrice: number;
};

const SUCCESS_STATUSES = new Set<SubscriptionStatus>(["active", "trialing", "past_due", "paused"]);
const HANDLED_WEBHOOKS = new Set([
  "subscription.created",
  "subscription.updated",
  "subscription.canceled",
  "transaction.completed",
  "transaction.payment_failed"
]);

function isHandledWebhookEvent(eventType: string) {
  return HANDLED_WEBHOOKS.has(eventType);
}

function getWebhookIdentifier(payload: Record<string, unknown>) {
  const eventId =
    typeof payload.event_id === "string"
      ? payload.event_id
      : typeof payload.notification_id === "string"
        ? payload.notification_id
        : null;

  if (eventId) {
    return eventId;
  }

  const body = JSON.stringify(payload);
  return randomUUID();
}

function getWebhookOccurredAt(payload: Record<string, unknown>) {
  return typeof payload.occurred_at === "string" ? payload.occurred_at : new Date().toISOString();
}

function isPaidStatus(status: SubscriptionStatus) {
  return SUCCESS_STATUSES.has(status);
}

function getRetryDelayMinutes(retryCount: number) {
  return Math.min(60, Math.max(5, 2 ** retryCount * 5));
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function findUserByEmail(email: string) {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("users")
    .select("*")
    .ilike("email", email)
    .maybeSingle<UserProfile>();

  return data ?? null;
}

async function findUserByPaddleCustomerId(customerId: string) {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("users")
    .select("*")
    .eq("paddle_customer_id", customerId)
    .maybeSingle<UserProfile>();

  return data ?? null;
}

async function findUserById(userId: string) {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("users")
    .select("*")
    .eq("id", userId)
    .maybeSingle<UserProfile>();

  return data ?? null;
}

async function findSubscriptionRowByPaddleId(paddleSubscriptionId: string) {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("subscriptions")
    .select("*")
    .eq("paddle_subscription_id", paddleSubscriptionId)
    .maybeSingle<SubscriptionRow>();

  return data ?? null;
}

async function resolveSelection(input: {
  customData?: Record<string, unknown> | null;
  priceId?: string | null;
}) {
  const parsed = parsePaddleSelection(input.customData);

  if (parsed) {
    return parsed;
  }

  if (!input.priceId) {
    return null;
  }

  return resolveSelectionFromPriceId(input.priceId);
}

function getSubscriptionPriceId(subscription: PaddleSubscription) {
  return subscription.items[0]?.price.id ?? null;
}

function getTransactionPriceId(transaction: PaddleTransaction) {
  return transaction.items?.[0]?.price?.id ?? null;
}

async function resolveUser(input: {
  customData?: Record<string, unknown> | null;
  customerId?: string | null;
  email?: string | null;
  paddleSubscriptionId?: string | null;
}) {
  if (typeof input.customData?.userId === "string") {
    const user = await findUserById(input.customData.userId);
    if (user) {
      return user;
    }
  }

  if (input.customerId) {
    const user = await findUserByPaddleCustomerId(input.customerId);
    if (user) {
      return user;
    }
  }

  if (input.email) {
    const user = await findUserByEmail(input.email);
    if (user) {
      return user;
    }
  }

  if (input.paddleSubscriptionId) {
    const existing = await findSubscriptionRowByPaddleId(input.paddleSubscriptionId);
    if (existing) {
      return findUserById(existing.user_id);
    }
  }

  return null;
}

function mapToSubscriptionStatus(status: string): SubscriptionStatus {
  const mapped = mapPaddleStatus(status);

  if (
    mapped === "active" ||
    mapped === "trialing" ||
    mapped === "paused" ||
    mapped === "past_due" ||
    mapped === "cancelled"
  ) {
    return mapped;
  }

  return "inactive";
}

async function upsertSubscriptionAndUser(input: {
  subscription: PaddleSubscription;
  selection: ResolvedSelection;
  user: UserProfile;
  lastPaymentDate?: string | null;
  statusOverride?: SubscriptionStatus;
}) {
  const admin = createSupabaseAdminClient();
  const status = input.statusOverride ?? mapToSubscriptionStatus(input.subscription.status);
  const nextBillingDate = status === "cancelled" ? null : input.subscription.next_billed_at;
  const subscriptionPayload = {
    user_id: input.user.id,
    email: input.user.email,
    plan_name: input.selection.planName,
    plan_tier: input.selection.plan,
    billing_interval: input.selection.billingCycle,
    original_price: input.selection.originalPrice,
    sale_price: input.selection.salePrice,
    paddle_customer_id: input.subscription.customer_id,
    paddle_subscription_id: input.subscription.id,
    status,
    next_billing_date: nextBillingDate,
    last_payment_date: input.lastPaymentDate ?? null
  };

  const { data: subscriptionRow, error: subscriptionError } = await admin
    .from("subscriptions")
    .upsert(subscriptionPayload, {
      onConflict: "paddle_subscription_id"
    })
    .select("*")
    .single<SubscriptionRow>();

  if (subscriptionError || !subscriptionRow) {
    throw new Error(subscriptionError?.message ?? "Unable to upsert subscription.");
  }

  const userPlan = status === "cancelled" ? "free" : input.selection.plan;
  const { error: userError } = await admin
    .from("users")
    .update({
      plan: userPlan,
      paddle_customer_id: input.subscription.customer_id,
      paddle_subscription_id: status === "cancelled" ? null : input.subscription.id,
      billing_cycle: status === "cancelled" ? null : input.selection.billingCycle,
      subscription_price: status === "cancelled" ? null : input.selection.salePrice,
      subscription_status: status,
      next_billing_date: nextBillingDate,
      last_payment_date: input.lastPaymentDate ?? input.user.last_payment_date ?? null,
      is_trial: status === "cancelled" ? false : false,
      trial_end_date: null,
      trial_ends_at: null
    })
    .eq("id", input.user.id);

  if (userError) {
    throw new Error(userError.message);
  }

  return subscriptionRow;
}

async function updateSubscriptionStatusFromTransaction(input: {
  transaction: PaddleTransaction;
  subscription?: PaddleSubscription | null;
  selection: ResolvedSelection;
  user: UserProfile;
  status: SubscriptionStatus;
  errorMessage?: string | null;
}) {
  const admin = createSupabaseAdminClient();
  const paddleSubscriptionId = input.subscription?.id ?? input.transaction.subscription_id;
  const nextBillingDate = input.subscription?.next_billed_at ?? input.user.next_billing_date ?? null;
  const currentLastPaymentDate = input.user.last_payment_date ?? null;
  const lastPaymentDate =
    input.status === "payment_failed"
      ? currentLastPaymentDate
      : input.transaction.billed_at ?? currentLastPaymentDate;

  if (paddleSubscriptionId) {
    await admin
      .from("subscriptions")
      .update({
        status: input.status,
        next_billing_date: nextBillingDate,
        last_payment_date: lastPaymentDate
      })
      .eq("paddle_subscription_id", paddleSubscriptionId);
  }

  const { error } = await admin
    .from("users")
    .update({
      plan: input.selection.plan,
      billing_cycle: input.selection.billingCycle,
      subscription_price: input.selection.salePrice,
      subscription_status: input.status,
      next_billing_date: nextBillingDate,
      last_payment_date: lastPaymentDate,
      paddle_customer_id: input.transaction.customer_id ?? input.user.paddle_customer_id,
      paddle_subscription_id: paddleSubscriptionId ?? input.user.paddle_subscription_id,
      is_trial: false,
      trial_end_date: null,
      trial_ends_at: null
    })
    .eq("id", input.user.id);

  if (error) {
    throw new Error(error.message);
  }

  await logBillingEvent({
    userId: input.user.id,
    email: input.user.email,
    planName: input.selection.planName,
    eventType: input.status === "payment_failed" ? "payment_failed" : "payment_succeeded",
    status: input.status === "payment_failed" ? "failed" : "success",
    errorMessage: input.errorMessage ?? null,
    amount: input.selection.salePrice,
    paddleEventId: null,
    paddleSubscriptionId: paddleSubscriptionId ?? null,
    occurredAt: input.transaction.updated_at
  });
}

async function loadTransactionWithSubscription(
  transactionId: string,
  attempts = 3
): Promise<{ transaction: PaddleTransaction; subscription: PaddleSubscription | null }> {
  let transaction = await getPaddleTransaction(transactionId);

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (transaction.subscription_id) {
      return {
        transaction,
        subscription: await getPaddleSubscription(transaction.subscription_id)
      };
    }

    if (attempt < attempts - 1) {
      await sleep(400);
      transaction = await getPaddleTransaction(transactionId);
    }
  }

  return {
    transaction,
    subscription: transaction.subscription_id ? await getPaddleSubscription(transaction.subscription_id) : null
  };
}

export async function confirmPaddleTransaction(transactionId: string, expectedUserId?: string) {
  const { transaction, subscription } = await loadTransactionWithSubscription(transactionId, 4);
  const selection = await resolveSelection({
    customData: transaction.custom_data ?? subscription?.custom_data,
    priceId: getTransactionPriceId(transaction) ?? (subscription ? getSubscriptionPriceId(subscription) : null)
  });

  if (!selection) {
    throw new Error("Unable to match the Paddle transaction to a configured subscription plan.");
  }

  const user = await resolveUser({
    customData: transaction.custom_data ?? subscription?.custom_data,
    customerId: transaction.customer_id,
    email: transaction.customer?.email ?? null,
    paddleSubscriptionId: transaction.subscription_id
  });

  if (!user) {
    throw new Error("Unable to find the user for this Paddle checkout.");
  }

  if (expectedUserId && user.id !== expectedUserId) {
    throw new Error("This Paddle checkout belongs to a different user.");
  }

  if (!subscription) {
    throw new Error("Paddle checkout completed but no subscription is attached yet.");
  }

  const subscriptionRow = await upsertSubscriptionAndUser({
    subscription,
    selection,
    user,
    lastPaymentDate: transaction.billed_at ?? transaction.updated_at
  });

  return {
    transaction,
    subscription,
    subscriptionRow,
    userId: user.id
  };
}

async function processSubscriptionEvent(eventType: string, payload: Record<string, unknown>) {
  const subscriptionId = typeof payload.data === "object" && payload.data !== null ? (payload.data as { id?: unknown }).id : null;

  if (typeof subscriptionId !== "string") {
    throw new Error("Missing subscription id on Paddle webhook payload.");
  }

  const subscription = await getPaddleSubscription(subscriptionId);
  const selection = await resolveSelection({
    customData: subscription.custom_data,
    priceId: getSubscriptionPriceId(subscription)
  });

  if (!selection) {
    throw new Error(`Unable to resolve the plan for Paddle subscription ${subscription.id}.`);
  }

  const user = await resolveUser({
    customData: subscription.custom_data,
    customerId: subscription.customer_id,
    paddleSubscriptionId: subscription.id
  });

  if (!user) {
    throw new Error(`Unable to resolve the user for Paddle subscription ${subscription.id}.`);
  }

  const subscriptionRow = await upsertSubscriptionAndUser({
    subscription,
    selection,
    user,
    lastPaymentDate: user.last_payment_date ?? null
  });

  const logEventType =
    eventType === "subscription.created"
      ? "subscription_created"
      : eventType === "subscription.canceled"
        ? "subscription_cancelled"
        : "subscription_updated";

  await logBillingEvent({
    subscriptionId: subscriptionRow.id,
    userId: user.id,
    email: user.email,
    planName: selection.planName,
    eventType: logEventType,
    status: subscriptionRow.status,
    paddleEventId: getWebhookIdentifier(payload),
    paddleSubscriptionId: subscription.id,
    occurredAt: getWebhookOccurredAt(payload)
  });

  return subscriptionRow;
}

async function processCompletedTransaction(payload: Record<string, unknown>) {
  const transactionId =
    typeof payload.data === "object" && payload.data !== null ? (payload.data as { id?: unknown }).id : null;

  if (typeof transactionId !== "string") {
    throw new Error("Missing transaction id on Paddle webhook payload.");
  }

  const { transaction, subscription } = await loadTransactionWithSubscription(transactionId, 1);
  const selection = await resolveSelection({
    customData: transaction.custom_data ?? subscription?.custom_data,
    priceId: getTransactionPriceId(transaction) ?? (subscription ? getSubscriptionPriceId(subscription) : null)
  });

  if (!selection) {
    throw new Error(`Unable to resolve the plan for Paddle transaction ${transaction.id}.`);
  }

  const user = await resolveUser({
    customData: transaction.custom_data ?? subscription?.custom_data,
    customerId: transaction.customer_id,
    email: transaction.customer?.email ?? null,
    paddleSubscriptionId: transaction.subscription_id
  });

  if (!user) {
    throw new Error(`Unable to resolve the user for Paddle transaction ${transaction.id}.`);
  }

  if (subscription) {
    await upsertSubscriptionAndUser({
      subscription,
      selection,
      user,
      lastPaymentDate: transaction.billed_at ?? transaction.updated_at
    });
  }

  await updateSubscriptionStatusFromTransaction({
    transaction,
    subscription,
    selection,
    user,
    status: "active"
  });
}

async function processFailedTransaction(payload: Record<string, unknown>) {
  const transactionId =
    typeof payload.data === "object" && payload.data !== null ? (payload.data as { id?: unknown }).id : null;

  if (typeof transactionId !== "string") {
    throw new Error("Missing transaction id on Paddle webhook payload.");
  }

  const transaction = await getPaddleTransaction(transactionId);
  const subscription =
    transaction.subscription_id ? await getPaddleSubscription(transaction.subscription_id) : null;
  const selection = await resolveSelection({
    customData: transaction.custom_data ?? subscription?.custom_data,
    priceId: getTransactionPriceId(transaction) ?? (subscription ? getSubscriptionPriceId(subscription) : null)
  });

  if (!selection) {
    throw new Error(`Unable to resolve the plan for failed Paddle transaction ${transaction.id}.`);
  }

  const user = await resolveUser({
    customData: transaction.custom_data ?? subscription?.custom_data,
    customerId: transaction.customer_id,
    email: transaction.customer?.email ?? null,
    paddleSubscriptionId: transaction.subscription_id
  });

  if (!user) {
    throw new Error(`Unable to resolve the user for failed Paddle transaction ${transaction.id}.`);
  }

  if (subscription) {
    await upsertSubscriptionAndUser({
      subscription,
      selection,
      user,
      lastPaymentDate: user.last_payment_date ?? null,
      statusOverride: "payment_failed"
    });
  }

  await updateSubscriptionStatusFromTransaction({
    transaction,
    subscription,
    selection,
    user,
    status: "payment_failed",
    errorMessage:
      typeof (payload.data as { error?: unknown })?.error === "string"
        ? (payload.data as { error: string }).error
        : null
  });
}

export async function handlePaddleWebhookPayload(payload: Record<string, unknown>) {
  const eventType = typeof payload.event_type === "string" ? payload.event_type : "";

  switch (eventType) {
    case "subscription.created":
    case "subscription.updated":
    case "subscription.canceled":
      return processSubscriptionEvent(eventType, payload);
    case "transaction.completed":
      return processCompletedTransaction(payload);
    case "transaction.payment_failed":
      return processFailedTransaction(payload);
    default:
      return null;
  }
}

export async function queuePaddleWebhook(payload: Record<string, unknown>) {
  const eventType = typeof payload.event_type === "string" ? payload.event_type : "";
  const admin = createSupabaseAdminClient();
  const paddleEventId = getWebhookIdentifier(payload);
  const occurredAt = getWebhookOccurredAt(payload);

  if (!isHandledWebhookEvent(eventType)) {
    return {
      queued: false,
      ignored: true,
      paddleEventId
    };
  }

  const { error } = await admin.from("paddle_webhook_events").upsert(
    {
      paddle_event_id: paddleEventId,
      event_type: eventType,
      payload,
      status: "pending",
      retry_count: 0,
      next_retry_at: occurredAt
    },
    {
      onConflict: "paddle_event_id"
    }
  );

  if (error) {
    throw new Error(error.message);
  }

  return {
    queued: true,
    ignored: false,
    paddleEventId
  };
}

async function markWebhookProcessing(id: string) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("paddle_webhook_events")
    .update({
      status: "processing"
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

async function markWebhookProcessed(id: string) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("paddle_webhook_events")
    .update({
      status: "processed",
      processed_at: new Date().toISOString(),
      last_error: null
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

async function markWebhookFailed(row: PaddleWebhookEventRecord, message: string) {
  const admin = createSupabaseAdminClient();
  const retryCount = row.retry_count + 1;
  const nextRetryAt = new Date(Date.now() + getRetryDelayMinutes(retryCount) * 60_000).toISOString();

  await admin
    .from("paddle_webhook_events")
    .update({
      status: "failed",
      retry_count: retryCount,
      next_retry_at: nextRetryAt,
      last_error: message
    })
    .eq("id", row.id);
}

export async function processQueuedPaddleWebhooks() {
  const batchSize = getCronBatchLimit("PADDLE_WEBHOOK_BATCH_LIMIT", 25);
  const guard = createCronExecutionGuard("process-paddle-webhooks", 12_000);
  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("paddle_webhook_events")
    .select("*")
    .in("status", ["pending", "failed"])
    .lte("next_retry_at", now)
    .order("created_at", { ascending: true })
    .limit(batchSize);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as PaddleWebhookEventRecord[];
  let processed = 0;

  for (const row of rows) {
    if (guard.shouldStop({ processed })) {
      break;
    }

    try {
      await markWebhookProcessing(row.id);
      await handlePaddleWebhookPayload(row.payload);
      await markWebhookProcessed(row.id);
      processed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown Paddle webhook processing error.";
      await markWebhookFailed(row, message);
      await logAdminError({
        errorType: "webhook_failed",
        errorMessage: message,
        context: {
          paddleEventId: row.paddle_event_id,
          eventType: row.event_type
        }
      });
      await logBillingEvent({
        email: "unknown",
        planName: null,
        eventType: "webhook_error",
        status: "failed",
        errorMessage: message,
        paddleEventId: row.paddle_event_id,
        occurredAt: row.created_at
      });
    }
  }

  return processed;
}
