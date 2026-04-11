import { NextRequest, NextResponse } from "next/server";

import { getClientByToken, saveGATokens } from "@/lib/client-token";
import { pickBestGaPropertyId } from "@/lib/ga";

export const runtime = "nodejs";

function getBaseUrl(request: NextRequest) {
  return process.env.NEXT_PUBLIC_BASE_URL ?? new URL(request.url).origin;
}

async function exchangeCodeForTokens(code: string, redirectUri: string) {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    throw new Error("Missing Google OAuth configuration.");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code
    }).toString(),
    cache: "no-store"
  });
  const payload = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    error_description?: string;
  };

  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description ?? "Unable to complete the GA4 connection.");
  }

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token ?? null
  };
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const token = request.nextUrl.searchParams.get("state");
  const baseUrl = getBaseUrl(request);

  if (!code || !token) {
    return NextResponse.redirect(new URL("/?ga=failed", baseUrl));
  }

  const client = await getClientByToken(token);

  if (!client) {
    return NextResponse.redirect(new URL(`/d/${token}?ga=failed`, baseUrl));
  }

  try {
    const redirectUri = `${baseUrl}/api/d/callback/ga`;
    const tokens = await exchangeCodeForTokens(code, redirectUri);
    const propertyId = await pickBestGaPropertyId(tokens.accessToken, client.url);

    await saveGATokens(token, tokens.accessToken, tokens.refreshToken, propertyId);

    return NextResponse.redirect(new URL(`/d/${token}?ga=connected`, baseUrl));
  } catch (error) {
    console.error("[api:d:callback:ga] error", {
      token,
      error: error instanceof Error ? error.message : "Unable to connect GA4."
    });

    return NextResponse.redirect(new URL(`/d/${token}?ga=failed`, baseUrl));
  }
}
