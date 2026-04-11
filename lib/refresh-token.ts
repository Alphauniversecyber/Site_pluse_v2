import "server-only";

import { getClientByToken } from "@/lib/client-token";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export async function refreshToken(clientToken: string, type: "gsc" | "ga") {
  const client = await getClientByToken(clientToken);

  if (!client) {
    throw new Error("This link is invalid or has expired.");
  }

  const refreshValue =
    type === "gsc" ? client.gsc_refresh_token ?? null : client.ga_refresh_token ?? null;

  if (!refreshValue) {
    throw new Error("No Google refresh token is available for this connection.");
  }

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    throw new Error("Missing Google OAuth credentials.");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: refreshValue
    }).toString(),
    cache: "no-store"
  });
  const payload = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    error_description?: string;
  };

  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description ?? "Unable to refresh the Google access token.");
  }

  const admin = createSupabaseAdminClient();
  const update =
    type === "gsc"
      ? {
          gsc_access_token: payload.access_token,
          gsc_refresh_token: payload.refresh_token ?? refreshValue
        }
      : {
          ga_access_token: payload.access_token,
          ga_refresh_token: payload.refresh_token ?? refreshValue
        };
  const { error } = await admin
    .from("websites")
    .update(update)
    .eq("magic_token", clientToken);

  if (error) {
    throw new Error(error.message);
  }

  return payload.access_token;
}
