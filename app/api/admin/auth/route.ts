import { NextResponse } from "next/server";

import { getAdminCookieOptions, getConfiguredAdminSecret } from "@/lib/admin/auth";
import { ADMIN_COOKIE_NAME } from "@/lib/admin/constants";

async function readPassword(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => null)) as { password?: string } | null;
    return body?.password?.trim() ?? "";
  }

  const formData = await request.formData().catch(() => null);
  return String(formData?.get("password") ?? "").trim();
}

export async function POST(request: Request) {
  const secret = getConfiguredAdminSecret();
  const password = await readPassword(request);

  if (!secret) {
    return NextResponse.redirect(new URL("/admin/login?config=missing", request.url));
  }

  if (!password || password !== secret) {
    return NextResponse.redirect(new URL("/admin/login?error=invalid", request.url));
  }

  const response = NextResponse.redirect(new URL("/admin", request.url));
  response.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: secret,
    ...getAdminCookieOptions()
  });

  return response;
}
