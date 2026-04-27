import "server-only";

import type { AdminCronName } from "@/lib/admin/constants";
import { apiError, apiSuccess } from "@/lib/api";
import { logAdminError, runLoggedCron } from "@/lib/admin/logging";
import { dispatchCronContinuation, getCronCursorOffset } from "@/lib/cron";

type ContinuableCronPayload = {
  processedCount: number;
  hasMore: boolean;
  nextCursor?: number | null;
};

function isAuthorizedCronRequest(request: Request, label: string) {
  const authHeader = request.headers.get("authorization");
  const headerSecret = request.headers.get("x-sitepulse-cron-secret");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error(`[cron:${label}] Missing CRON_SECRET environment variable.`);
    return false;
  }

  return authHeader === `Bearer ${cronSecret}` || headerSecret === cronSecret;
}

export async function runContinuableCronRoute<T extends ContinuableCronPayload>(
  request: Request,
  input: {
    cronName: AdminCronName;
    label: string;
    failureMessage: string;
    run: (cursor: number) => Promise<T>;
    allowContinuation?: boolean;
    continuationMode?: "self_dispatch" | "scheduled";
  }
) {
  if (!isAuthorizedCronRequest(request, input.label)) {
    console.warn(`[cron:${input.label}] Unauthorized request.`, {
      hasAuthorizationHeader: request.headers.has("authorization"),
      userAgent: request.headers.get("user-agent")
    });
    return apiError("Unauthorized", 401);
  }

  try {
    const cursor = getCronCursorOffset(request);
    const result = await runLoggedCron(input.cronName, () => input.run(cursor));
    const continuationMode =
      input.allowContinuation === false
        ? "disabled"
        : input.continuationMode ?? (input.allowContinuation ? "self_dispatch" : "disabled");
    const continuation =
      continuationMode === "self_dispatch"
        ? await dispatchCronContinuation({
          request,
          label: input.label,
          hasMore: result.hasMore,
          nextCursor: result.nextCursor ?? null
        })
        : continuationMode === "scheduled" && result.hasMore
          ? {
              queued: false,
              reason: "deferred_to_scheduler" as const,
              nextCursor: result.nextCursor ?? null,
              nextChainDepth: 0,
              maxChainDepth: 0
            }
          : {
          queued: false,
          reason: "no_more_work" as const,
          nextCursor: result.nextCursor ?? null,
          nextChainDepth: 0,
          maxChainDepth: 0
        };

    if (
      continuationMode === "self_dispatch" &&
      result.hasMore &&
      !continuation.queued &&
      continuation.reason !== "no_more_work"
    ) {
      await logAdminError({
        errorType: "cron_failed",
        errorMessage: `Cron continuation was not queued for ${input.label}.`,
        context: {
          cronName: input.cronName,
          reason: continuation.reason,
          nextCursor: continuation.nextCursor,
          nextChainDepth: continuation.nextChainDepth,
          maxChainDepth: continuation.maxChainDepth,
          dispatchError: continuation.errorMessage ?? null
        },
        dedupeWindowMinutes: 10
      });
    }

    return apiSuccess({
      ...result,
      continuation
    });
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : input.failureMessage,
      500
    );
  }
}
