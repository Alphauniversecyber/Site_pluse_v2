import { runLoggedCron } from "@/lib/admin/logging";
import { apiError, apiSuccess } from "@/lib/api";
import { enqueueJob, isAuthorizedCronRequest } from "@/lib/job-queue";
import { enqueueDueReportPdfs } from "@/lib/report-pdf-queue";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return apiError("Unauthorized", 401);
  }

  try {
    const result = await runLoggedCron("process-report-pdfs", async () => {
      const enqueueResult = await enqueueDueReportPdfs();
      const queued = await enqueueJob(
        "process-report-pdfs",
        {
          mode: "process-queue",
          requestedAt: new Date().toISOString(),
          source: "cron"
        },
        {
          skipIfOpen: true
        }
      );

      return {
        processedCount: enqueueResult.queuedCount,
        queuedCount: enqueueResult.queuedCount,
        discoveredCount: enqueueResult.inspectedCount,
        queued: queued.queued,
        jobId: queued.job.id
      };
    });

    return apiSuccess(result);
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "Unable to queue scheduled report PDFs.",
      500
    );
  }
}
