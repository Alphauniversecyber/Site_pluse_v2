import { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api";
import { buildEmptyGaData, fetchGaDashboardData, isGoogleAuthError } from "@/lib/ga";
import { disconnectClientGoogleService, getClientByToken } from "@/lib/client-token";
import { refreshToken } from "@/lib/refresh-token";

export const runtime = "nodejs";

function shouldClearGaConnection(error: unknown) {
  if (isGoogleAuthError(error)) {
    return true;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  return /expired|revoked|invalid authentication credentials|invalid_grant/i.test(error.message);
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return apiError("Missing dashboard token.", 400);
  }

  const client = await getClientByToken(token);

  if (!client) {
    return apiError("This link is invalid or has expired.", 404);
  }

  const isConnected = Boolean((client.ga_refresh_token || client.ga_access_token) && client.ga_property_id);
  const disconnected = buildEmptyGaData({
    connected: false,
    propertyId: client.ga_property_id ?? null,
    source: "disconnected"
  });
  const clearedDisconnected = buildEmptyGaData({
    connected: false,
    propertyId: null,
    source: "disconnected"
  });
  const unavailable = buildEmptyGaData({
    connected: isConnected,
    propertyId: client.ga_property_id ?? null
  });

  if (!client.ga_access_token || !client.ga_property_id) {
    return apiSuccess(disconnected);
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
        if (shouldClearGaConnection(refreshError)) {
          await disconnectClientGoogleService(token, "ga");
          return apiSuccess(clearedDisconnected);
        }

        console.error("[api:d:ga-data] refresh failed", {
          token,
          error: refreshError instanceof Error ? refreshError.message : "Unable to refresh GA4 token."
        });
      }
    }

    if (shouldClearGaConnection(error)) {
      await disconnectClientGoogleService(token, "ga");
      return apiSuccess(clearedDisconnected);
    }

    console.error("[api:d:ga-data] live fetch failed", {
      token,
      error: error instanceof Error ? error.message : "Unable to load GA4 data."
    });

    return apiSuccess(unavailable);
  }
}
