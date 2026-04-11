import { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api";
import { buildMockGaData, fetchGaDashboardData, isGoogleAuthError } from "@/lib/ga";
import { getClientByToken } from "@/lib/client-token";
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

  const fallback = buildMockGaData({
    seed: token,
    websiteUrl: client.url,
    connected: Boolean(client.ga_refresh_token || client.ga_access_token),
    propertyId: client.ga_property_id ?? null
  });

  if (!client.ga_access_token || !client.ga_property_id) {
    return apiSuccess(fallback);
  }

  try {
    const data = await fetchGaDashboardData({
      accessToken: client.ga_access_token,
      propertyId: client.ga_property_id
    });

    return apiSuccess(data);
  } catch (error) {
    if (client.ga_refresh_token && isGoogleAuthError(error)) {
      try {
        const refreshedToken = await refreshToken(token, "ga");
        const data = await fetchGaDashboardData({
          accessToken: refreshedToken,
          propertyId: client.ga_property_id
        });

        return apiSuccess(data);
      } catch (refreshError) {
        console.error("[api:d:ga-data] refresh failed", {
          token,
          error: refreshError instanceof Error ? refreshError.message : "Unable to refresh GA4 token."
        });
      }
    }

    console.error("[api:d:ga-data] live fetch failed", {
      token,
      error: error instanceof Error ? error.message : "Unable to load GA4 data."
    });

    return apiSuccess(fallback);
  }
}
