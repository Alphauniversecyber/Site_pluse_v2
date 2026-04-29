import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const SLOW_CRON_JOB_TYPES = [
  "process-scans",
  "process-reports",
  "process-uptime",
  "process-competitors"
] as const;

export type SlowCronJobType = (typeof SLOW_CRON_JOB_TYPES)[number];
export type JobQueueStatus = "pending" | "processing" | "done" | "failed";

export type JobQueuePayload = {
  mode?: "discover" | "process-queue";
  discoveryOffset?: number;
  offset?: number;
  websiteId?: string;
  competitorUrl?: string;
  requestedAt?: string;
  source?: string;
  result?: Record<string, unknown>;
  error?: string;
};

export type JobQueueRow = {
  id: string;
  job_type: SlowCronJobType;
  payload: JobQueuePayload;
  status: JobQueueStatus;
  created_at: string;
  processed_at: string | null;
};

const STALE_PROCESSING_MINUTES = 5;

export function isAuthorizedCronRequest(request: Request) {
  const authHeader = request.headers.get("authorization");
  const headerSecret = request.headers.get("x-sitepulse-cron-secret");
  const cronSecret = process.env.CRON_SECRET?.trim();

  if (!cronSecret) {
    console.error("[job-queue] Missing CRON_SECRET environment variable.");
    return false;
  }

  return authHeader === `Bearer ${cronSecret}` || headerSecret === cronSecret;
}

export function isSlowCronJobType(value: string): value is SlowCronJobType {
  return SLOW_CRON_JOB_TYPES.includes(value as SlowCronJobType);
}

export async function releaseStaleProcessingJobs(jobType?: SlowCronJobType) {
  const admin = createSupabaseAdminClient();
  const staleBefore = new Date(Date.now() - STALE_PROCESSING_MINUTES * 60_000).toISOString();
  let query = admin
    .from("job_queue")
    .update({
      status: "pending",
      processed_at: null
    })
    .eq("status", "processing")
    .or(`processed_at.lt.${staleBefore},and(processed_at.is.null,created_at.lt.${staleBefore})`)
    .select("*");

  if (jobType) {
    query = query.eq("job_type", jobType);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as JobQueueRow[];
}

export async function findOpenJob(jobType: SlowCronJobType) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("job_queue")
    .select("*")
    .eq("job_type", jobType)
    .in("status", ["pending", "processing"])
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<JobQueueRow>();

  if (error) {
    throw new Error(error.message);
  }

  return data ?? null;
}

export async function enqueueJob(
  jobType: SlowCronJobType,
  payload: JobQueuePayload,
  options?: {
    skipIfOpen?: boolean;
  }
) {
  if (options?.skipIfOpen) {
    await releaseStaleProcessingJobs(jobType);
    const existing = await findOpenJob(jobType);
    if (existing) {
      return {
        queued: false,
        job: existing
      };
    }
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("job_queue")
    .insert({
      job_type: jobType,
      payload,
      status: "pending"
    })
    .select("*")
    .single<JobQueueRow>();

  if (error || !data) {
    throw new Error(error?.message ?? `Unable to enqueue ${jobType}.`);
  }

  return {
    queued: true,
    job: data
  };
}

export async function claimPendingJobs(limit = 5, jobType?: SlowCronJobType) {
  await releaseStaleProcessingJobs(jobType);
  const admin = createSupabaseAdminClient();
  let query = admin
    .from("job_queue")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (jobType) {
    query = query.eq("job_type", jobType);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  const claimed: JobQueueRow[] = [];

  for (const row of ((data ?? []) as JobQueueRow[])) {
    if (!isSlowCronJobType(row.job_type)) {
      continue;
    }

    const { data: updated, error: claimError } = await admin
      .from("job_queue")
      .update({
        status: "processing",
        processed_at: new Date().toISOString()
      })
      .eq("id", row.id)
      .eq("status", "pending")
      .select("*")
      .maybeSingle<JobQueueRow>();

    if (claimError) {
      throw new Error(claimError.message);
    }

    if (updated) {
      claimed.push(updated);
    }
  }

  return claimed;
}

export async function markJobDone(jobId: string, payload: JobQueuePayload) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("job_queue")
    .update({
      status: "done",
      payload,
      processed_at: new Date().toISOString()
    })
    .eq("id", jobId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function markJobFailed(jobId: string, payload: JobQueuePayload) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("job_queue")
    .update({
      status: "failed",
      payload,
      processed_at: new Date().toISOString()
    })
    .eq("id", jobId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function getPendingJobCount(jobType?: SlowCronJobType) {
  const admin = createSupabaseAdminClient();
  let query = admin
    .from("job_queue")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

  if (jobType) {
    query = query.eq("job_type", jobType);
  }

  const { count, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

export async function getOpenJobCount(jobType?: SlowCronJobType) {
  const admin = createSupabaseAdminClient();
  let query = admin
    .from("job_queue")
    .select("*", { count: "exact", head: true })
    .in("status", ["pending", "processing"]);

  if (jobType) {
    query = query.eq("job_type", jobType);
  }

  const { count, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}
