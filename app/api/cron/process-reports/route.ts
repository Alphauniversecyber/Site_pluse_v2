import { apiError, apiSuccess } from "@/lib/api";
import { enqueueJob, isAuthorizedCronRequest } from "@/lib/job-queue";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return apiError("Unauthorized", 401);
  }

  try {
    const pdfJob = await enqueueJob(
      "process-report-pdfs",
      {
        mode: "process-queue",
        requestedAt: new Date().toISOString(),
        source: "cron-compat"
      },
      {
        skipIfOpen: true
      }
    );
    const emailJob = await enqueueJob(
      "process-report-emails",
      {
        mode: "process-queue",
        requestedAt: new Date().toISOString(),
        source: "cron-compat"
      },
      {
        skipIfOpen: true
      }
    );

    const result = {
      processedCount: Number(pdfJob.queued) + Number(emailJob.queued),
      queuedPdfWorker: pdfJob.queued,
      queuedEmailWorker: emailJob.queued,
      pdfJobId: pdfJob.job.id,
      emailJobId: emailJob.job.id,
      deprecated: true
    };

    return apiSuccess(result);
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "Unable to queue scheduled reports.",
      500
    );
  }
}
