import { NextResponse, type NextRequest } from "next/server";

import { ADMIN_COOKIE_NAME } from "@/lib/admin/constants";
import { updateSession } from "@/lib/auth";

const CANONICAL_HOST = "www.trysitepulse.com";
const LEGACY_HOST = "trysitepulse.com";

function shouldCanonicalizeRequest(request: NextRequest) {
  return (
    (request.method === "GET" || request.method === "HEAD") &&
    !request.nextUrl.pathname.startsWith("/api/")
  );
}

function buildCanonicalRedirect(request: NextRequest) {
  if (!shouldCanonicalizeRequest(request)) {
    return null;
  }

  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = (forwardedHost ?? request.nextUrl.host).split(":")[0]?.toLowerCase() ?? "";
  const proto = (request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "")).toLowerCase();
  const pathname = request.nextUrl.pathname;

  const needsHostRedirect = host === LEGACY_HOST;
  const needsHttpsRedirect = (host === LEGACY_HOST || host === CANONICAL_HOST) && proto === "http";
  const needsLegacySignupRedirect = pathname === "/register" || pathname === "/register/";

  if (!needsHostRedirect && !needsHttpsRedirect && !needsLegacySignupRedirect) {
    return null;
  }

  const redirectUrl = request.nextUrl.clone();

  if (needsHostRedirect || needsHttpsRedirect) {
    redirectUrl.protocol = "https";
    redirectUrl.host = CANONICAL_HOST;
  }

  if (needsLegacySignupRedirect) {
    redirectUrl.pathname = "/signup";
  }

  return NextResponse.redirect(redirectUrl, 301);
}

export async function middleware(request: NextRequest) {
  const canonicalRedirect = buildCanonicalRedirect(request);

  if (canonicalRedirect) {
    return canonicalRedirect;
  }

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
