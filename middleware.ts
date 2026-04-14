import { NextResponse, type NextRequest } from "next/server";

import { ADMIN_COOKIE_NAME } from "@/lib/admin/constants";
import { updateSession } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (pathname.startsWith("/admin")) {
    const isLoginPage = pathname === "/admin/login";
    const adminSecret = process.env.ADMIN_SECRET?.trim() ?? "";
    const adminCookie = request.cookies.get(ADMIN_COOKIE_NAME)?.value ?? "";
    const isAuthorized = Boolean(adminSecret) && adminCookie === adminSecret;

    if (!isLoginPage && !isAuthorized) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/login";
      return NextResponse.redirect(url);
    }

    if (isLoginPage && isAuthorized) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin";
      return NextResponse.redirect(url);
    }
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|images|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"
  ]
};
