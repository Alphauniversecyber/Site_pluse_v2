import { NextResponse } from "next/server";

import { ADMIN_COOKIE_NAME } from "@/lib/admin/constants";

export async function POST(request: Request) {
  const url = new URL("/admin/login", request.url);
  const response = NextResponse.redirect(url);

  response.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: "",
    path: "/admin",
    httpOnly: true,
    maxAge: 0,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  });

  return response;
}
