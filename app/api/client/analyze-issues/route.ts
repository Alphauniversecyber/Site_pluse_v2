import { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api";
import {
  analyzeClientIssues,
  buildSlimPayload,
  ClientAiParseError
} from "@/lib/client-dashboard-ai";
import { getClientByToken } from "@/lib/client-token";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import type { GaDashboardData, GscDashboardData } from "@/types";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  console.log("[api/client/analyze-issues] route hit");

  const body = (await request.json().catch(() => null)) as
    | {
        token?: string;
        clearSaved?: boolean;
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
    const admin = createSupabaseAdminClient();

    if (body.clearSaved) {
      const { error: clearError } = await admin
        .from("websites")
        .update({
          ai_issues: null,
          ai_issues_generated_at: null
        })
        .eq("magic_token", body.token);

      if (clearError) {
        throw new Error(`Unable to clear saved AI issues. ${clearError.message}`);
      }
    }

    const slimPayload = buildSlimPayload(body.auditData ?? null, body.gscData ?? null, body.ga4Data ?? null);
    const issues = await analyzeClientIssues({
      slimPayload
    });
    const generatedAt = new Date().toISOString();
    const { data: saved, error: saveError } = await admin
      .from("websites")
      .update({
        ai_issues: issues,
        ai_issues_generated_at: generatedAt
      })
      .eq("magic_token", body.token)
      .select("ai_issues_generated_at")
      .maybeSingle<{ ai_issues_generated_at: string | null }>();

    if (saveError) {
      throw new Error(`Unable to save AI issues. ${saveError.message}`);
    }

    return apiSuccess({
      issues,
      generatedAt: saved?.ai_issues_generated_at ?? generatedAt
    });
  } catch (error) {
    if (error instanceof ClientAiParseError) {
      return Response.json(
        {
          error: error.message,
          rawText: error.rawText
        },
        { status: 500 }
      );
    }

    return apiError(error instanceof Error ? error.message : "Unable to analyze issues right now.", 500);
  }
}
