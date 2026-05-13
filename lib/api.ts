import "server-only";

import { NextResponse } from "next/server";

import type { UserProfile } from "@/types";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const NO_INDEX_HEADERS = {
  "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet"
} as const;

export function withNoIndex<T extends Response>(response: T) {
  Object.entries(NO_INDEX_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}

export function apiError(message: string, status = 400) {
  return NextResponse.json(
    { error: message },
    {
      status,
      headers: {
        "Cache-Control": "no-store, max-age=0",
        Pragma: "no-cache",
        Expires: "0"
      }
    }
  );
}

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json(
    { data },
    {
      status,
      headers: {
        "Cache-Control": "no-store, max-age=0",
        Pragma: "no-cache",
        Expires: "0"
      }
    }
  );
}

export async function requireApiUser() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      supabase,
      user: null,
      profile: null,
      errorResponse: apiError("Unauthorized", 401)
    };
  }

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single<UserProfile>();

  if (!profile) {
    return {
      supabase,
      user,
      profile: null,
      errorResponse: apiError("User profile not found", 404)
    };
  }

  return {
    supabase,
    user,
    profile,
    errorResponse: null
  };
}

export async function requireApiUserFromRequest(request: Request) {
  const authorization = request.headers.get("authorization");
  const bearerToken = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : null;

  if (!bearerToken) {
    return requireApiUser();
  }

  const supabase = createSupabaseAdminClient();
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser(bearerToken);

  if (authError || !user) {
    return {
      supabase,
      user: null,
      profile: null,
      errorResponse: apiError("Unauthorized", 401)
    };
  }

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single<UserProfile>();

  if (!profile) {
    return {
      supabase,
      user,
      profile: null,
      errorResponse: apiError("User profile not found", 404)
    };
  }

  return {
    supabase,
    user,
    profile,
    errorResponse: null
  };
}
