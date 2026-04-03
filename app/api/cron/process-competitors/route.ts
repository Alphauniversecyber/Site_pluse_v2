import { apiError, apiSuccess } from "@/lib/api";
import { processCompetitorScans } from "@/lib/competitor-monitoring";

export const runtime = "nodejs";

function isAuthorized(request: Request) {
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`;
  return request.headers.has("x-vercel-cron") || authHeader === expected;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return apiError("Unauthorized", 401);
  }

  try {
    const processed = await processCompetitorScans();
    return apiSuccess({ processed });
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Unable to process competitor scans.", 500);
  }
}
