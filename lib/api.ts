import "server-only";

import { NextResponse } from "next/server";

import type { UserProfile } from "@/types";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export function apiError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
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
