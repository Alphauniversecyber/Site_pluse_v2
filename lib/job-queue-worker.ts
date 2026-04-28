import "server-only";

import { logAdminError } from "@/lib/admin/logging";
import {
  enqueueCompetitorScanJobsBatch,
  processQueuedCompetitorScanJob
} from "@/lib/competitor-monitoring";
import {
  claimPendingJobs,
  enqueueJob,
  getOpenJobCount,
  getPendingJobCount,
  markJobDone,
  markJobFailed,
  type SlowCronJobType,
  type JobQueuePayload,
  type JobQueueRow
} from "@/lib/job-queue";
import { enqueueDueReportEmails, processQueuedReportEmails } from "@/lib/report-email-queue";
import { enqueueDueScanJobs, processQueuedScanJobs } from "@/lib/scan-job-queue";
import { processDailyUptimeChecksBatch } from "@/lib/uptime-monitoring";

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

    await enqueueJob("process-scans", {
      mode: enqueueResult.hasMoreCandidates ? "discover" : "process-queue",
      discoveryOffset: enqueueResult.hasMoreCandidates ? enqueueResult.nextOffset ?? 0 : 0,
      requestedAt: new Date().toISOString(),
      source: "worker-continuation"
    });

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
    await enqueueJob("process-scans", {
      mode: "process-queue",
      requestedAt: new Date().toISOString(),
      source: "worker-continuation"
    });
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

    await enqueueJob("process-reports", {
      mode: enqueueResult.hasMoreCandidates ? "discover" : "process-queue",
      discoveryOffset: enqueueResult.hasMoreCandidates ? enqueueResult.nextOffset ?? 0 : 0,
      requestedAt: new Date().toISOString(),
      source: "worker-continuation"
    });

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
    await enqueueJob("process-reports", {
      mode: "process-queue",
      requestedAt: new Date().toISOString(),
      source: "worker-continuation"
    });
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
    await enqueueJob("process-uptime", {
      mode: "process-queue",
      offset: result.nextCursor ?? 0,
      requestedAt: new Date().toISOString(),
      source: "worker-continuation"
    });
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

export async function processQueueBatch(jobType?: SlowCronJobType) {
  const jobs = await claimPendingJobs(1, jobType);
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

  const pendingCount = await getPendingJobCount(jobType);
  const openCount = await getOpenJobCount(jobType);

  return {
    jobType: jobType ?? "all",
    processed: jobs.length,
    remaining: openCount,
    pending: pendingCount,
    done: openCount === 0,
    results
  };
}

export async function drainQueue(jobType?: SlowCronJobType, maxIterations = 20) {
  let totalProcessed = 0;
  let remaining = 0;
  let iterations = 0;
  let done = false;
  const results: Array<Record<string, unknown>> = [];

  for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
    const batch = await processQueueBatch(jobType);
    iterations = iteration;
    totalProcessed += batch.processed;
    remaining = batch.remaining;
    done = batch.done;
    results.push(...batch.results);

    if (done || remaining === 0) {
      break;
    }
  }

  return {
    jobType: jobType ?? "all",
    processed: totalProcessed,
    remaining,
    done,
    iterations,
    results
  };
}
