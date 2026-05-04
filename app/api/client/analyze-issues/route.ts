import { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api";
import { analyzeClientIssues } from "@/lib/client-dashboard-ai";
import { getClientByToken } from "@/lib/client-token";
import type { GaDashboardData, GscDashboardData } from "@/types";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as
    | {
        token?: string;
        auditData?: Record<string, unknown> | null;
        gscData?: GscDashboardData | null;
        ga4Data?: GaDashboardData | null;
      }
    | null;

  if (!body?.token) {
    return apiError("Missing dashboard token.", 400);
  }

  const client = await getClientByToken(body.token);

  if (!client) {
    return apiError("This link is invalid or has expired.", 404);
  }

  try {
    const issues = await analyzeClientIssues({
      token: body.token,
      auditData: body.auditData ?? null,
      gscData: body.gscData ?? null,
      ga4Data: body.ga4Data ?? null
    });

    return apiSuccess({ issues });
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Unable to analyze issues right now.", 500);
  }
}
