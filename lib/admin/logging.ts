import "server-only";

import type { AdminCronName } from "@/lib/admin/constants";
import type { EmailTemplateId } from "@/types";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export type AdminLoggedErrorType =
  | "scan_failed"
  | "seo_audit_failed"
  | "pdf_failed"
  | "report_failed"
  | "email_failed"
  | "cron_failed"
  | "webhook_failed";

type CronLogStatus = "running" | "success" | "failed" | "timeout";

function isMissingTableError(error: unknown) {
  return error instanceof Error && /does not exist|relation .* does not exist/i.test(error.message);
}

function isDuplicateContext(left: Record<string, unknown>, right: Record<string, unknown>) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export async function createCronLog(cronName: AdminCronName) {
  try {
    const admin = createSupabaseAdminClient();
    const { data } = await admin
      .from("cron_logs")
      .insert({
        cron_name: cronName,
        started_at: new Date().toISOString(),
        status: "running",
        items_processed: 0
      })
      .select("id")
      .single();

    return data?.id as string | null;
  } catch (error) {
    if (!isMissingTableError(error)) {
      console.warn("[admin:cron_log_create_failed]", {
        cronName,
        error: error instanceof Error ? error.message : "Unknown cron log create error"
      });
    }

    return null;
  }
}

export async function finalizeCronLog(input: {
  id: string | null;
  status: CronLogStatus;
  itemsProcessed: number;
  errorMessage?: string | null;
}) {
  if (!input.id) {
    return;
  }

  try {
    const admin = createSupabaseAdminClient();
    await admin
      .from("cron_logs")
      .update({
        finished_at: new Date().toISOString(),
        status: input.status,
        items_processed: input.itemsProcessed,
        error_message: input.errorMessage ?? null
      })
      .eq("id", input.id);
  } catch (error) {
    if (!isMissingTableError(error)) {
      console.warn("[admin:cron_log_finalize_failed]", {
        id: input.id,
        error: error instanceof Error ? error.message : "Unknown cron log finalize error"
      });
    }
  }
}

export async function logAdminError(input: {
  errorType: AdminLoggedErrorType;
  errorMessage: string;
  websiteId?: string | null;
  userId?: string | null;
  context?: Record<string, unknown>;
  dedupeWindowMinutes?: number;
}) {
  try {
    const admin = createSupabaseAdminClient();
    const context = input.context ?? {};

    if (input.dedupeWindowMinutes && input.dedupeWindowMinutes > 0) {
      const windowStart = new Date(Date.now() - input.dedupeWindowMinutes * 60_000).toISOString();
      const { data: recentRows } = await admin
        .from("admin_error_logs")
        .select("error_message, context")
        .eq("error_type", input.errorType)
        .eq("website_id", input.websiteId ?? null)
        .eq("user_id", input.userId ?? null)
        .gte("created_at", windowStart)
        .order("created_at", { ascending: false })
        .limit(10);

      const duplicateExists = ((recentRows ?? []) as Array<{ error_message: string; context: Record<string, unknown> }>)
        .some((row) => row.error_message === input.errorMessage && isDuplicateContext(row.context ?? {}, context));

      if (duplicateExists) {
        return;
      }
    }

    await admin.from("admin_error_logs").insert({
      error_type: input.errorType,
      error_message: input.errorMessage,
      website_id: input.websiteId ?? null,
      user_id: input.userId ?? null,
      context
    });
  } catch (error) {
    if (!isMissingTableError(error)) {
      console.warn("[admin:error_log_failed]", {
        errorType: input.errorType,
        error: error instanceof Error ? error.message : "Unknown admin error log failure"
      });
    }
  }
}

export async function logEmailDelivery(input: {
  to: string;
  subject: string;
  kind: string;
  templateId?: EmailTemplateId | null;
  dedupeKey?: string | null;
  campaign?: string | null;
  status: "sent" | "failed";
  websiteId?: string | null;
  userId?: string | null;
  providerMessageId?: string | null;
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
  triggeredAt?: string | null;
}) {
  try {
    const admin = createSupabaseAdminClient();
    await admin.from("email_logs").insert({
      to_email: input.to,
      subject: input.subject,
      email_type: input.kind,
      template_id: input.templateId ?? null,
      dedupe_key: input.dedupeKey ?? null,
      campaign: input.campaign ?? null,
      status: input.status,
      website_id: input.websiteId ?? null,
      user_id: input.userId ?? null,
      provider: "resend",
      provider_message_id: input.providerMessageId ?? null,
      error_message: input.errorMessage ?? null,
      metadata: input.metadata ?? {},
      triggered_at: input.triggeredAt ?? new Date().toISOString(),
      sent_at: new Date().toISOString()
    });
  } catch (error) {
    if (!isMissingTableError(error)) {
      console.warn("[admin:email_log_failed]", {
        to: input.to,
        subject: input.subject,
        error: error instanceof Error ? error.message : "Unknown email log failure"
      });
    }
  }
}

export async function logBillingEvent(input: {
  subscriptionId?: string | null;
  userId?: string | null;
  email: string;
  planName?: string | null;
  eventType: string;
  status: string;
  errorMessage?: string | null;
  amount?: number | null;
  paddleEventId?: string | null;
  paddleSubscriptionId?: string | null;
  metadata?: Record<string, unknown>;
  occurredAt?: string | null;
}) {
  try {
    const admin = createSupabaseAdminClient();
    await admin.from("payment_logs").insert({
      subscription_id: input.subscriptionId ?? null,
      user_id: input.userId ?? null,
      user_email: input.email,
      plan_name: input.planName ?? null,
      event_type: input.eventType,
      status: input.status,
      error_message: input.errorMessage ?? null,
      amount: input.amount ?? null,
      paddle_event_id: input.paddleEventId ?? null,
      paddle_subscription_id: input.paddleSubscriptionId ?? null,
      metadata: input.metadata ?? {},
      timestamp: input.occurredAt ?? new Date().toISOString()
    });
  } catch (error) {
    if (!isMissingTableError(error)) {
      console.warn("[admin:billing_log_failed]", {
        email: input.email,
        eventType: input.eventType,
        error: error instanceof Error ? error.message : "Unknown billing log failure"
      });
    }
  }
}

export async function hasSentEmailWithDedupeKey(dedupeKey: string | null | undefined) {
  if (!dedupeKey) {
    return false;
  }

  try {
    const admin = createSupabaseAdminClient();
    const { data } = await admin
      .from("email_logs")
      .select("id")
      .eq("dedupe_key", dedupeKey)
      .eq("status", "sent")
      .limit(1)
      .maybeSingle<{ id: string }>();

    return Boolean(data?.id);
  } catch (error) {
    if (!isMissingTableError(error)) {
      console.warn("[admin:email_log_lookup_failed]", {
        dedupeKey,
        error: error instanceof Error ? error.message : "Unknown email log lookup failure"
      });
    }

    return false;
  }
}

function countProcessedItems(value: unknown) {
  if (Array.isArray(value)) {
    return value.length;
  }

  if (typeof value === "number") {
    return value;
  }

  if (value && typeof value === "object") {
    const maybeCount = (value as { count?: unknown }).count;
    if (typeof maybeCount === "number") {
      return maybeCount;
    }
  }

  return 0;
}

export async function runLoggedCron<T>(cronName: AdminCronName, callback: () => Promise<T>) {
  const logId = await createCronLog(cronName);

  try {
    const result = await callback();
    await finalizeCronLog({
      id: logId,
      status: "success",
      itemsProcessed: countProcessedItems(result)
    });

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown cron execution error.";
    await finalizeCronLog({
      id: logId,
      status: /timeout/i.test(message) ? "timeout" : "failed",
      itemsProcessed: 0,
      errorMessage: message
    });
    await logAdminError({
      errorType: "cron_failed",
      errorMessage: message,
      context: {
        cronName
      }
    });
    throw error;
  }
}
