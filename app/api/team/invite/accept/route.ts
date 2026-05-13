import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { acceptPendingInviteByToken } from "@/lib/team-access";
import { ACTIVE_WORKSPACE_COOKIE } from "@/lib/workspace";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token")?.trim() ?? "";

  if (!token) {
    return NextResponse.redirect(new URL("/invite/declined?state=invalid", url.origin));
  }

  try {
    const result = await acceptPendingInviteByToken(token);
    if (!result.invite) {
      return NextResponse.redirect(new URL("/invite/declined?state=invalid", url.origin));
    }

    if (!result.user) {
      const signupUrl = new URL("/signup", url.origin);
      signupUrl.searchParams.set("invite_token", token);
      signupUrl.searchParams.set("email", result.invite.invited_email);
      return NextResponse.redirect(signupUrl);
    }

    const supabase = createSupabaseServerClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();
    const targetPath = user
      ? "/dashboard?joined=1"
      : `/login?next=${encodeURIComponent("/dashboard?joined=1")}`;
    const response = NextResponse.redirect(new URL(targetPath, url.origin));

    response.cookies.set(ACTIVE_WORKSPACE_COOKIE, result.invite.workspace_owner_id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30
    });

    return response;
  } catch {
    return NextResponse.redirect(new URL("/invite/declined?state=invalid", url.origin));
  }
}
