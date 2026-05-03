import { runContinuableCronRoute } from "@/lib/cron-route";
import { logAdminError } from "@/lib/admin/logging";
import { processLifecycleEmailsBatch, sendActivationEmails } from "@/lib/lifecycle-email-service";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  return runContinuableCronRoute(request, {
    cronName: "process-lifecycle-emails",
    label: "process-lifecycle-emails",
    failureMessage: "Unable to process lifecycle emails.",
    run: async (cursor) => {
      let activationResult = {
        sentKeys: [] as string[],
        processedCount: 0,
        inspectedCount: 0
      };

      if (cursor === 0) {
        try {
          activationResult = await sendActivationEmails();
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unable to process activation lifecycle emails.";

          console.error("[cron:process-lifecycle-emails] activation_sequence_failed", {
            error: message
          });

          await logAdminError({
            errorType: "cron_failed",
            errorMessage: message,
            context: {
              cronName: "process-lifecycle-emails",
              activationEmail: true
            },
            dedupeWindowMinutes: 10
          });
        }
      }

      const lifecycleResult = await processLifecycleEmailsBatch({
        offset: cursor
      });

      return {
        ...lifecycleResult,
        sentKeys: [...activationResult.sentKeys, ...lifecycleResult.sentKeys],
        processedCount: activationResult.processedCount + lifecycleResult.processedCount,
        inspectedCount: activationResult.inspectedCount + lifecycleResult.inspectedCount
      };
    }
  });
}
