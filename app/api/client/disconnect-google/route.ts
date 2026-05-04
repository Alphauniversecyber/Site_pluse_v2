import { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api";
import { disconnectClientGoogleService, getClientByToken } from "@/lib/client-token";

export const runtime = "nodejs";

async function revokeGoogleToken(token: string | null | undefined) {
  if (!token) {
    return;
  }

  try {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
      method: "POST",
      cache: "no-store"
    });
  } catch (error) {
    console.error("[api:client:disconnect-google] revoke failed", error);
  }
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as
    | {
        token?: string;
        service?: "gsc" | "ga";
      }
    | null;

  if (!body?.token || (body.service !== "gsc" && body.service !== "ga")) {
    return apiError("Missing token or service.", 400);
  }

  const client = await getClientByToken(body.token);

  if (!client) {
    return apiError("This link is invalid or has expired.", 404);
  }

  const tokensToRevoke =
    body.service === "gsc"
      ? [client.gsc_access_token, client.gsc_refresh_token]
      : [client.ga_access_token, client.ga_refresh_token];

  await Promise.all(tokensToRevoke.map((token) => revokeGoogleToken(token)));
  await disconnectClientGoogleService(body.token, body.service);

  return apiSuccess({ service: body.service, disconnected: true });
}
