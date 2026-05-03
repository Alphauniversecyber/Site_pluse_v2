import { NextResponse } from "next/server";

import { declinePendingInviteByToken } from "@/lib/team-access";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token")?.trim() ?? "";

  if (token) {
    try {
      await declinePendingInviteByToken(token);
    } catch {
      // Ignore decline failures and still show the status page.
    }
  }

  return NextResponse.redirect(new URL("/invite/declined", url.origin));
}
