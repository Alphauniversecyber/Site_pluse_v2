import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const FAILED_TASK_STATUSES = ["failed", "retried", "resolved"] as const;

export type FailedTaskStatus = (typeof FAILED_TASK_STATUSES)[number];

export const FAILED_TASK_TYPES = [
  "generate-report",
  "send-report-email",
  "execute-scan",
  "send-activation-day1",
  "send-activation-day3",
  "send-activation-day7",
  "run-uptime-check",
  "sync-uptimerobot-user",
  "scan-competitor",
  "process-paddle-webhook"
] as const;

export type FailedTaskType = (typeof FAILED_TASK_TYPES)[number];

export type FailedTaskRecord = {
  id: string;
  cron_name: string;
  task_type: FailedTaskType;
  user_id: string | null;
  site_id: string | null;
  error_message: string;
  payload: Record<string, unknown>;
  status: FailedTaskStatus;
  created_at: string;
  retried_at: string | null;
  retry_count: number;
  resolved_at: string | null;
};

function isMissingTableError(error: unknown) {
  return error instanceof Error && /does not exist|relation .* does not exist/i.test(error.message);
}

export function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export async function logFailedTask(input: {
  cronName: string;
  taskType: FailedTaskType;
  userId?: string | null;
  siteId?: string | null;
  errorMessage: string;
  payload?: Record<string, unknown>;
}) {
  try {
    const admin = createSupabaseAdminClient();
    await admin.from("failed_tasks").insert({
      cron_name: input.cronName,
      task_type: input.taskType,
      user_id: input.userId ?? null,
      site_id: input.siteId ?? null,
      error_message: input.errorMessage,
      payload: input.payload ?? {},
      status: "failed",
      retry_count: 0,
      resolved_at: null
    });
  } catch (error) {
    if (!isMissingTableError(error)) {
      console.warn("[failed_tasks:log_failed]", {
        cronName: input.cronName,
        taskType: input.taskType,
        error: getErrorMessage(error, "Unknown failed task log error")
      });
    }
  }
}

export async function getFailedTaskById(id: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("failed_tasks")
    .select("*")
    .eq("id", id)
    .maybeSingle<FailedTaskRecord>();

  if (error) {
    throw new Error(error.message);
  }

  return data ?? null;
}

export async function markFailedTaskRetried(id: string) {
  const admin = createSupabaseAdminClient();
  const retriedAt = new Date().toISOString();
  const { data, error } = await admin
    .from("failed_tasks")
    .update({
      status: "retried",
      retried_at: retriedAt,
      resolved_at: null
    })
    .eq("id", id)
    .select("*")
    .single<FailedTaskRecord>();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to update failed task.");
  }

  return data;
}

export async function markFailedTaskResolved(id: string) {
  const admin = createSupabaseAdminClient();
  const resolvedAt = new Date().toISOString();
  const { data, error } = await admin
    .from("failed_tasks")
    .update({
      status: "resolved",
      resolved_at: resolvedAt
    })
    .eq("id", id)
    .select("*")
    .single<FailedTaskRecord>();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to resolve failed task.");
  }

  return data;
}

export async function markFailedTaskRetryFailed(
  id: string,
  errorMessage: string,
  status: FailedTaskStatus = "retried"
) {
  const admin = createSupabaseAdminClient();
  const { data: existing, error: existingError } = await admin
    .from("failed_tasks")
    .select("retry_count")
    .eq("id", id)
    .single<{ retry_count: number }>();

  if (existingError || !existing) {
    throw new Error(existingError?.message ?? "Unable to load failed task retry state.");
  }

  const { data, error } = await admin
    .from("failed_tasks")
    .update({
      status,
      error_message: errorMessage,
      retry_count: (existing.retry_count ?? 0) + 1,
      retried_at: new Date().toISOString(),
      resolved_at: null
    })
    .eq("id", id)
    .select("*")
    .single<FailedTaskRecord>();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to update failed task after retry.");
  }

  return data;
}
