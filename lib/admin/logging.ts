import "server-only";

import type { AdminCronName } from "@/lib/admin/constants";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export type AdminLoggedErrorType =
  | "scan_failed"
  | "seo_audit_failed"
  | "pdf_failed"
  | "report_failed"
  | "email_failed"
  | "cron_failed";

type CronLogStatus = "running" | "success" | "failed" | "timeout";

function isMissingTableError(error: unknown) {
  return error instanceof Error && /does not exist|relation .* does not exist/i.test(error.message);
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
}) {
  try {
    const admin = createSupabaseAdminClient();
    await admin.from("admin_error_logs").insert({
      error_type: input.errorType,
      error_message: input.errorMessage,
      website_id: input.websiteId ?? null,
      user_id: input.userId ?? null,
      context: input.context ?? {}
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
  status: "sent" | "failed";
  websiteId?: string | null;
  userId?: string | null;
  providerMessageId?: string | null;
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    const admin = createSupabaseAdminClient();
    await admin.from("email_logs").insert({
      to_email: input.to,
      subject: input.subject,
      email_type: input.kind,
      status: input.status,
      website_id: input.websiteId ?? null,
      user_id: input.userId ?? null,
      provider: "resend",
      provider_message_id: input.providerMessageId ?? null,
      error_message: input.errorMessage ?? null,
      metadata: input.metadata ?? {},
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
