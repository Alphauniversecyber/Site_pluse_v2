import { NextRequest, NextResponse } from "next/server";

import { apiError } from "@/lib/api";
import { getClientByToken } from "@/lib/client-token";

export const runtime = "nodejs";

function getBaseUrl(request: NextRequest) {
  return process.env.NEXT_PUBLIC_BASE_URL ?? new URL(request.url).origin;
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return apiError("Missing dashboard token.", 400);
  }

  if (!(await getClientByToken(token))) {
    return apiError("This link is invalid or has expired.", 404);
  }

  if (!process.env.GOOGLE_CLIENT_ID) {
    return apiError("Missing Google OAuth configuration.", 500);
  }

  const redirectUri = `${getBaseUrl(request)}/api/d/callback/ga`;
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");

  url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "https://www.googleapis.com/auth/analytics.readonly");
  url.searchParams.set("state", token);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");

  return NextResponse.redirect(url);
}
