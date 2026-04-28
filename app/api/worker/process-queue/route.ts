import { NextResponse } from "next/server";

import { apiError } from "@/lib/api";
import { isAuthorizedCronRequest } from "@/lib/job-queue";
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
    const batch = await processQueueBatch();

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
