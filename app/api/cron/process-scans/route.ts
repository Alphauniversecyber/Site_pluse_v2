import { apiError, apiSuccess } from "@/lib/api";
import { processDueScans } from "@/lib/scan-service";

export const runtime = "nodejs";

function isAuthorized(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[cron:process-scans] Missing CRON_SECRET environment variable.");
    return false;
  }

  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    console.warn("[cron:process-scans] Unauthorized request.", {
      hasAuthorizationHeader: request.headers.has("authorization"),
      userAgent: request.headers.get("user-agent")
    });
    return apiError("Unauthorized", 401);
  }

  try {
    const executed = await processDueScans();
    return apiSuccess({ executed });
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Unable to process scheduled scans.", 500);
  }
}
