import { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api";
import {
  analyzeClientRecommendations,
  buildSlimPayload,
  ClientAiParseError
} from "@/lib/client-dashboard-ai";
import { getClientByToken } from "@/lib/client-token";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import type { GaDashboardData, GscDashboardData } from "@/types";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  console.log("[api/client/analyze-recommendations] route hit");

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
          ai_recommendations: null,
          ai_recommendations_generated_at: null
        })
        .eq("magic_token", body.token);

      if (clearError) {
        console.error(
          "[api/client/analyze-recommendations] unable to clear saved AI recommendations",
          clearError
        );
      }
    }

    const slimPayload = buildSlimPayload(body.auditData ?? null, body.gscData ?? null, body.ga4Data ?? null);
    const recommendations = await analyzeClientRecommendations({
      slimPayload
    });
    const generatedAt = new Date().toISOString();
    const { data: saved, error: saveError } = await admin
      .from("websites")
      .update({
        ai_recommendations: recommendations,
        ai_recommendations_generated_at: generatedAt
      })
      .eq("magic_token", body.token)
      .select("ai_recommendations_generated_at")
      .maybeSingle<{ ai_recommendations_generated_at: string | null }>();

    if (saveError) {
      console.error(
        "[api/client/analyze-recommendations] unable to save AI recommendations",
        saveError
      );
    }

    return apiSuccess({
      recommendations,
      generatedAt: saved?.ai_recommendations_generated_at ?? generatedAt
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

    return apiError(
      error instanceof Error ? error.message : "Unable to analyze recommendations right now.",
      500
    );
  }
}
