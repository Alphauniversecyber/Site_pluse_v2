import { apiError, apiSuccess } from "@/lib/api";
import { logAdminError } from "@/lib/admin/logging";
import {
  claimPendingJobs,
  enqueueJob,
  getPendingJobCount,
  isAuthorizedCronRequest,
  markJobDone,
  markJobFailed,
  type JobQueuePayload,
  type JobQueueRow
} from "@/lib/job-queue";
import { enqueueDueReportEmails, processQueuedReportEmails } from "@/lib/report-email-queue";
import { enqueueDueScanJobs, processQueuedScanJobs } from "@/lib/scan-job-queue";
import { processDailyUptimeChecksBatch } from "@/lib/uptime-monitoring";

export const runtime = "nodejs";
export const maxDuration = 60;

const SCAN_DISCOVERY_LIMIT = 25;
const SCAN_QUEUE_LIMIT = 1;
const REPORT_DISCOVERY_LIMIT = 25;
const REPORT_QUEUE_LIMIT = 1;
const UPTIME_LIMIT = 5;

function getNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback;
}

async function processScanJob(job: JobQueueRow) {
  const payload = job.payload ?? {};
  const mode = payload.mode === "process-only" ? "process-only" : "discover-and-process";
  const discoveryOffset = getNumber(payload.discoveryOffset, 0);

  const enqueueResult =
    mode === "process-only"
      ? {
          queuedCount: 0,
          inspectedCount: 0,
          nextOffset: null,
          hasMoreCandidates: false
        }
      : await enqueueDueScanJobs(SCAN_DISCOVERY_LIMIT, discoveryOffset);
  const queueResult = await processQueuedScanJobs(SCAN_QUEUE_LIMIT);

  if (enqueueResult.hasMoreCandidates) {
    await enqueueJob(
      "process-scans",
      {
        mode: "discover-and-process",
        discoveryOffset: enqueueResult.nextOffset ?? 0,
        requestedAt: new Date().toISOString(),
        source: "worker-continuation"
      }
    );
  } else if (queueResult.hasMore) {
    await enqueueJob(
      "process-scans",
      {
        mode: "process-only",
        requestedAt: new Date().toISOString(),
        source: "worker-continuation"
      }
    );
  }

  return {
    queuedCount: enqueueResult.queuedCount,
    discoveredCount: enqueueResult.inspectedCount,
    processedCount: queueResult.processedCount,
    queueInspectedCount: queueResult.inspectedCount,
    hasMore: enqueueResult.hasMoreCandidates || queueResult.hasMore,
    nextOffset: enqueueResult.nextOffset
  };
}

async function processReportJob(job: JobQueueRow) {
  const payload = job.payload ?? {};
  const mode = payload.mode === "process-only" ? "process-only" : "discover-and-process";
  const discoveryOffset = getNumber(payload.discoveryOffset, 0);

  const enqueueResult =
    mode === "process-only"
      ? {
          queuedCount: 0,
          inspectedCount: 0,
          nextOffset: null,
          hasMoreCandidates: false
        }
      : await enqueueDueReportEmails(REPORT_DISCOVERY_LIMIT, discoveryOffset);
  const queueResult = await processQueuedReportEmails(REPORT_QUEUE_LIMIT);

  if (enqueueResult.hasMoreCandidates) {
    await enqueueJob(
      "process-reports",
      {
        mode: "discover-and-process",
        discoveryOffset: enqueueResult.nextOffset ?? 0,
        requestedAt: new Date().toISOString(),
        source: "worker-continuation"
      }
    );
  } else if (queueResult.hasMore) {
    await enqueueJob(
      "process-reports",
      {
        mode: "process-only",
        requestedAt: new Date().toISOString(),
        source: "worker-continuation"
      }
    );
  }

  return {
    queuedCount: enqueueResult.queuedCount,
    discoveredCount: enqueueResult.inspectedCount,
    processedCount: queueResult.processedCount,
    queueInspectedCount: queueResult.inspectedCount,
    hasMore: enqueueResult.hasMoreCandidates || queueResult.hasMore,
    nextOffset: enqueueResult.nextOffset
  };
}

async function processUptimeJob(job: JobQueueRow) {
  const payload = job.payload ?? {};
  const offset = getNumber(payload.offset, 0);
  const result = await processDailyUptimeChecksBatch({
    limit: UPTIME_LIMIT,
    offset
  });

  if (result.hasMore) {
    await enqueueJob(
      "process-uptime",
      {
        offset: result.nextCursor ?? 0,
        requestedAt: new Date().toISOString(),
        source: "worker-continuation"
      }
    );
  }

  return {
    processedCount: result.processedCount,
    inspectedCount: result.inspectedCount,
    hasMore: result.hasMore,
    nextOffset: result.nextCursor
  };
}

async function processJob(job: JobQueueRow) {
  if (job.job_type === "process-scans") {
    return processScanJob(job);
  }

  if (job.job_type === "process-reports") {
    return processReportJob(job);
  }

  return processUptimeJob(job);
}

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return apiError("Unauthorized", 401);
  }

  try {
    const jobs = await claimPendingJobs(5);
    const results: Array<Record<string, unknown>> = [];

    for (const job of jobs) {
      try {
        const result = await processJob(job);
        const nextPayload: JobQueuePayload = {
          ...job.payload,
          result,
          requestedAt: job.payload?.requestedAt ?? new Date().toISOString(),
          source: job.payload?.source ?? "cron"
        };

        await markJobDone(job.id, nextPayload);
        results.push({
          id: job.id,
          jobType: job.job_type,
          status: "done",
          result
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to process queued job.";
        const failedPayload: JobQueuePayload = {
          ...job.payload,
          error: message,
          source: job.payload?.source ?? "cron"
        };

        await logAdminError({
          errorType: "cron_failed",
          errorMessage: message,
          context: {
            queue: "job_queue",
            jobId: job.id,
            jobType: job.job_type
          },
          dedupeWindowMinutes: 10
        });
        await markJobFailed(job.id, failedPayload);
        results.push({
          id: job.id,
          jobType: job.job_type,
          status: "failed",
          error: message
        });
      }
    }

    const pendingCount = await getPendingJobCount();

    return apiSuccess({
      processedCount: jobs.length,
      results,
      pendingCount,
      hasMore: pendingCount > 0
    });
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "Unable to process the job queue.",
      500
    );
  }
}
