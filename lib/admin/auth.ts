import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { apiError } from "@/lib/api";
import { ADMIN_COOKIE_NAME } from "@/lib/admin/constants";

function getAdminSecret() {
  return process.env.ADMIN_SECRET?.trim() ?? "";
}

function getCookieValueFromHeader(cookieHeader: string | null | undefined, name: string) {
  if (!cookieHeader) {
    return null;
  }

  const parts = cookieHeader.split(";");

  for (const part of parts) {
    const [rawName, ...rawValue] = part.trim().split("=");

    if (rawName === name) {
      return rawValue.join("=").trim() || null;
    }
  }

  return null;
}

export function isAdminSecretValid(value: string | null | undefined) {
  const secret = getAdminSecret();
  return Boolean(secret) && value === secret;
}

export function getAdminCookieValue() {
  return cookies().get(ADMIN_COOKIE_NAME)?.value ?? null;
}

export function isAdminAuthenticated() {
  return isAdminSecretValid(getAdminCookieValue());
}

export function requireAdminPageAccess() {
  if (!isAdminAuthenticated()) {
    redirect("/admin/login");
  }
}

export function redirectAdminIfAuthenticated() {
  if (isAdminAuthenticated()) {
    redirect("/admin");
  }
}

export function getAdminCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12
  };
}

export function getAdminAuthorizationHeader() {
  const secret = getAdminSecret();
  return secret ? `Bearer ${secret}` : "";
}

export function requireAdminApiAuthorization(request: Request) {
  const authorization = request.headers.get("authorization");
  const cookieValueFromHeader = getCookieValueFromHeader(
    request.headers.get("cookie"),
    ADMIN_COOKIE_NAME
  );
  const cookieValueFromStore = getAdminCookieValue();
  const cookieValue = cookieValueFromHeader ?? cookieValueFromStore;

  if (
    !isAdminSecretValid(authorization?.replace(/^Bearer\s+/i, "")) &&
    !isAdminSecretValid(cookieValue)
  ) {
    return apiError("Unauthorized", 401);
  }

  return null;
}

export function getConfiguredAdminSecret() {
  return getAdminSecret();
}
