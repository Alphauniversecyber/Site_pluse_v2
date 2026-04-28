import { NextResponse } from "next/server";

import { apiError } from "@/lib/api";
import { isAuthorizedCronRequest, isSlowCronJobType } from "@/lib/job-queue";
import { processQueueBatch } from "@/lib/job-queue-worker";

export const runtime = "nodejs";
export const maxDuration = 60;

const noStoreHeaders = {
  "Cache-Control": "no-store, max-age=0",
  Pragma: "no-cache",
  Expires: "0"
};

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return apiError("Unauthorized", 401);
  }

  try {
    const { searchParams } = new URL(request.url);
    const requestedJob = searchParams.get("job")?.trim() ?? "";

    if (!requestedJob || !isSlowCronJobType(requestedJob)) {
      return apiError("Invalid or missing job type.", 422);
    }

    const batch = await processQueueBatch(requestedJob);

    return NextResponse.json(batch, {
      status: 200,
      headers: noStoreHeaders
    });
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "Unable to process the job queue.",
      500
    );
  }
}
