import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { buildAppUserRecord, buildGoogleProfileRecord } from "@/lib/google-auth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { autoAcceptPendingInvitesForUser } from "@/lib/team-access";
import { ACTIVE_WORKSPACE_COOKIE } from "@/lib/workspace";

function createCallbackSupabaseClient(response: NextResponse) {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({
            name,
            value,
            ...options
          });
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({
            name,
            value: "",
            ...options,
            maxAge: 0
          });
        }
      }
    }
  );
}

async function upsertAuthenticatedUserProfile(user: User) {
  const admin = createSupabaseAdminClient();
  const [{ error: userError }, { error: profileError }] = await Promise.all([
    admin.from("users").upsert(buildAppUserRecord(user), {
      onConflict: "id"
    }),
    admin.from("profiles").upsert(buildGoogleProfileRecord(user), {
      onConflict: "user_id"
    })
  ]);

  if (userError) {
    throw userError;
  }

  if (profileError) {
    throw profileError;
  }
}

function buildAuthFailureRedirect(url: URL) {
  return NextResponse.redirect(new URL("/login?error=auth", url.origin));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const nextPath = url.searchParams.get("next");
  const safeNextPath = nextPath && nextPath.startsWith("/") ? nextPath : "/dashboard";
  const redirectUrl = new URL(safeNextPath, url.origin);
  const response = NextResponse.redirect(redirectUrl);
  const supabase = createCallbackSupabaseClient(response);

  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const recoveryTokenHash = tokenHash && type === "recovery" ? tokenHash : null;

  if (recoveryTokenHash) {
    try {
      await supabase.auth.verifyOtp({
        token_hash: recoveryTokenHash,
        type: "recovery"
      });
    } catch {
      return NextResponse.redirect(new URL("/reset-password?error=recovery-link", url.origin));
    }
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return buildAuthFailureRedirect(url);
    }
  } else {
    return buildAuthFailureRedirect(url);
  }

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return recoveryTokenHash
      ? NextResponse.redirect(new URL("/reset-password?error=recovery-link", url.origin))
      : buildAuthFailureRedirect(url);
  }

  if (code) {
    try {
      await upsertAuthenticatedUserProfile(user);
    } catch (error) {
      console.error("Unable to sync the authenticated user profile during auth callback.", error);
      return buildAuthFailureRedirect(url);
    }
  }

  if (user?.email && !safeNextPath.startsWith("/api/team/invite/accept")) {
    try {
      const acceptedOwnerIds = await autoAcceptPendingInvitesForUser({
        userId: user.id,
        email: user.email
      });

      if (acceptedOwnerIds.length > 0 && safeNextPath === "/dashboard") {
        response.cookies.set({
          name: ACTIVE_WORKSPACE_COOKIE,
          value: acceptedOwnerIds[0],
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          maxAge: 60 * 60 * 24 * 30
        });
      }
    } catch (error) {
      console.error("Unable to auto-accept pending team invites during auth callback.", error);
    }
  }

  return response;
}
