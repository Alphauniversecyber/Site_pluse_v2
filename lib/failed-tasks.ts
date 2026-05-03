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
      status: "failed"
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
  const { data, error } = await admin
    .from("failed_tasks")
    .update({
      status: "retried",
      retried_at: new Date().toISOString()
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
  const { data, error } = await admin
    .from("failed_tasks")
    .update({
      status: "resolved"
    })
    .eq("id", id)
    .select("*")
    .single<FailedTaskRecord>();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to resolve failed task.");
  }

  return data;
}
