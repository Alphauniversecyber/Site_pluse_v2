import { runLoggedCron } from "@/lib/admin/logging";
import { apiError, apiSuccess } from "@/lib/api";
import { enqueueJob, isAuthorizedCronRequest } from "@/lib/job-queue";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return apiError("Unauthorized", 401);
  }

  try {
    const result = await runLoggedCron("process-uptime", async () => {
      const queued = await enqueueJob(
        "process-uptime",
        {
          offset: 0,
          requestedAt: new Date().toISOString(),
          source: "cron"
        },
        {
          skipIfOpen: true
        }
      );

      return {
        processedCount: queued.queued ? 1 : 0,
        queued: queued.queued,
        jobId: queued.job.id
      };
    });

    return apiSuccess(result);
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "Unable to queue uptime checks.",
      500
    );
  }
}
