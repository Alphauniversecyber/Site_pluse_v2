import { apiError, apiSuccess } from "@/lib/api";
import { logAdminError } from "@/lib/admin/logging";
import {
  enqueueCompetitorScanJobsBatch,
  processQueuedCompetitorScanJob
} from "@/lib/competitor-monitoring";
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
const COMPETITOR_DISCOVERY_LIMIT = 10;

function getNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback;
}

async function processScanJob(job: JobQueueRow) {
  const payload = job.payload ?? {};
  const mode = payload.mode === "process-queue" ? "process-queue" : "discover";
  const discoveryOffset = getNumber(payload.discoveryOffset, 0);

  if (mode === "discover") {
    const enqueueResult = await enqueueDueScanJobs(SCAN_DISCOVERY_LIMIT, discoveryOffset);

    await enqueueJob(
      "process-scans",
      {
        mode: enqueueResult.hasMoreCandidates ? "discover" : "process-queue",
        discoveryOffset: enqueueResult.hasMoreCandidates ? enqueueResult.nextOffset ?? 0 : 0,
        requestedAt: new Date().toISOString(),
        source: "worker-continuation"
      }
    );

    return {
      phase: "discover",
      queuedCount: enqueueResult.queuedCount,
      discoveredCount: enqueueResult.inspectedCount,
      hasMore: true,
      nextOffset: enqueueResult.nextOffset
    };
  }

  const queueResult = await processQueuedScanJobs(SCAN_QUEUE_LIMIT);

  if (queueResult.hasMore) {
    await enqueueJob(
      "process-scans",
      {
        mode: "process-queue",
        requestedAt: new Date().toISOString(),
        source: "worker-continuation"
      }
    );
  }

  return {
    phase: "process-queue",
    processedCount: queueResult.processedCount,
    queueInspectedCount: queueResult.inspectedCount,
    hasMore: queueResult.hasMore,
    nextOffset: null
  };
}

async function processReportJob(job: JobQueueRow) {
  const payload = job.payload ?? {};
  const mode = payload.mode === "process-queue" ? "process-queue" : "discover";
  const discoveryOffset = getNumber(payload.discoveryOffset, 0);

  if (mode === "discover") {
    const enqueueResult = await enqueueDueReportEmails(REPORT_DISCOVERY_LIMIT, discoveryOffset);

    await enqueueJob(
      "process-reports",
      {
        mode: enqueueResult.hasMoreCandidates ? "discover" : "process-queue",
        discoveryOffset: enqueueResult.hasMoreCandidates ? enqueueResult.nextOffset ?? 0 : 0,
        requestedAt: new Date().toISOString(),
        source: "worker-continuation"
      }
    );

    return {
      phase: "discover",
      queuedCount: enqueueResult.queuedCount,
      discoveredCount: enqueueResult.inspectedCount,
      hasMore: true,
      nextOffset: enqueueResult.nextOffset
    };
  }

  const queueResult = await processQueuedReportEmails(REPORT_QUEUE_LIMIT);

  if (queueResult.hasMore) {
    await enqueueJob(
      "process-reports",
      {
        mode: "process-queue",
        requestedAt: new Date().toISOString(),
        source: "worker-continuation"
      }
    );
  }

  return {
    phase: "process-queue",
    processedCount: queueResult.processedCount,
    queueInspectedCount: queueResult.inspectedCount,
    hasMore: queueResult.hasMore,
    nextOffset: null
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
        mode: "process-queue",
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

async function processCompetitorJob(job: JobQueueRow) {
  const payload = job.payload ?? {};
  const mode = payload.mode === "process-queue" ? "process-queue" : "discover";
  const discoveryOffset = getNumber(payload.discoveryOffset, 0);

  if (mode === "discover") {
    const enqueueResult = await enqueueCompetitorScanJobsBatch({
      limit: COMPETITOR_DISCOVERY_LIMIT,
      offset: discoveryOffset
    });

    if (enqueueResult.hasMore) {
      await enqueueJob("process-competitors", {
        mode: "discover",
        discoveryOffset: enqueueResult.nextOffset ?? 0,
        requestedAt: new Date().toISOString(),
        source: "worker-continuation"
      });
    }

    return {
      phase: "discover",
      queuedCount: enqueueResult.queuedCount,
      discoveredCount: enqueueResult.inspectedCount,
      hasMore: enqueueResult.hasMore,
      nextOffset: enqueueResult.nextOffset
    };
  }

  if (!payload.websiteId || !payload.competitorUrl) {
    throw new Error("Competitor queue job is missing websiteId or competitorUrl.");
  }

  const result = await processQueuedCompetitorScanJob({
    websiteId: payload.websiteId,
    competitorUrl: payload.competitorUrl
  });

  return {
    phase: "process-queue",
    ...result,
    hasMore: false,
    nextOffset: null
  };
}

async function processJob(job: JobQueueRow) {
  if (job.job_type === "process-scans") {
    return processScanJob(job);
  }

  if (job.job_type === "process-reports") {
    return processReportJob(job);
  }

  if (job.job_type === "process-competitors") {
    return processCompetitorJob(job);
  }

  return processUptimeJob(job);
}

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return apiError("Unauthorized", 401);
  }

  try {
    const jobs = await claimPendingJobs(1);
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
