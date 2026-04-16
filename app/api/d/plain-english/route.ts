import { apiError, apiSuccess } from "@/lib/api";
import {
  rewriteIssuesToPlainEnglish,
  rewriteRecommendationsToPlainEnglish
} from "@/lib/client-dashboard-plain-english";
import type { ClientDashboardRewriteContext } from "@/types";

export const runtime = "nodejs";

type PlainEnglishRequest =
  | {
      type: "issues";
      context?: ClientDashboardRewriteContext;
      items: Array<{ id: string; title: string; description: string; severity: string }>;
    }
  | {
      type: "recommendations";
      context?: ClientDashboardRewriteContext;
      items: Array<{ id: string; title: string; description: string; priority: string }>;
    };

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as PlainEnglishRequest | null;

  if (!body || !Array.isArray(body.items) || (body.type !== "issues" && body.type !== "recommendations")) {
    return apiError("Invalid plain-English request.", 422);
  }

  try {
    if (body.type === "issues") {
      const items = await rewriteIssuesToPlainEnglish(body.items, body.context);
      return apiSuccess({ rewritten: true, items });
    }

    const items = await rewriteRecommendationsToPlainEnglish(body.items, body.context);
    return apiSuccess({ rewritten: true, items });
  } catch (error) {
    console.error("[api:d:plain-english] rewrite failed", {
      type: body.type,
      error: error instanceof Error ? error.message : "Unable to rewrite dashboard content."
    });

    return apiSuccess({
      rewritten: false,
      items: body.items
    });
  }
}
