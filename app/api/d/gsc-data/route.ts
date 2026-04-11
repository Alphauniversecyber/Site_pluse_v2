import { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api";
import { getClientByToken } from "@/lib/client-token";
import { buildMockGscData, fetchGscDashboardData, isGoogleAuthError } from "@/lib/gsc";
import { refreshToken } from "@/lib/refresh-token";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return apiError("Missing dashboard token.", 400);
  }

  const client = await getClientByToken(token);

  if (!client) {
    return apiError("This link is invalid or has expired.", 404);
  }

  const fallback = buildMockGscData({
    seed: token,
    websiteUrl: client.url,
    connected: Boolean(client.gsc_refresh_token || client.gsc_access_token),
    property: client.gsc_property ?? null
  });

  if (!client.gsc_access_token || !client.gsc_property) {
    return apiSuccess(fallback);
  }

  try {
    const data = await fetchGscDashboardData({
      accessToken: client.gsc_access_token,
      property: client.gsc_property
    });

    return apiSuccess(data);
  } catch (error) {
    if (client.gsc_refresh_token && isGoogleAuthError(error)) {
      try {
        const refreshedToken = await refreshToken(token, "gsc");
        const data = await fetchGscDashboardData({
          accessToken: refreshedToken,
          property: client.gsc_property
        });

        return apiSuccess(data);
      } catch (refreshError) {
        console.error("[api:d:gsc-data] refresh failed", {
          token,
          error: refreshError instanceof Error ? refreshError.message : "Unable to refresh Search Console token."
        });
      }
    }

    console.error("[api:d:gsc-data] live fetch failed", {
      token,
      error: error instanceof Error ? error.message : "Unable to load Search Console data."
    });

    return apiSuccess(fallback);
  }
}
