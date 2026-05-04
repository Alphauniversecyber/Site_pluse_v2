import { runLoggedCron } from "@/lib/admin/logging";
import { apiError, apiSuccess } from "@/lib/api";
import { enqueueJob, isAuthorizedCronRequest } from "@/lib/job-queue";
import { enqueueFailedScanRetryJobs } from "@/lib/scan-job-queue";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return apiError("Unauthorized", 401);
  }

  try {
    const result = await runLoggedCron("retry-failed-scans", async () => {
      const enqueueResult = await enqueueFailedScanRetryJobs();
      const queued = await enqueueJob(
        "process-scans",
        {
          mode: "process-queue",
          requestedAt: new Date().toISOString(),
          source: "retry-failed-scans"
        },
        {
          skipIfOpen: true
        }
      );

      return {
        processedCount: enqueueResult.queuedCount,
        queuedCount: enqueueResult.queuedCount,
        discoveredCount: enqueueResult.inspectedCount,
        candidateCount: enqueueResult.candidateCount,
        queued: queued.queued,
        jobId: queued.job.id
      };
    });

    return apiSuccess(result);
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "Unable to queue failed scan retries.",
      500
    );
  }
}
