import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { hasActivePaidPlan, isTrialExpired } from "@/lib/trial";

const SUPABASE_AUTH_TIMEOUT_MS = 5_000;

function isSupabaseAuthRequest(input: Parameters<typeof fetch>[0]) {
  const url =
    typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

  return url.includes("/auth/v1/");
}

function createMiddlewareSupabaseFetch() {
  return async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const response = await fetch(input, {
      ...init,
      cache: "no-store"
    });

    if (!isSupabaseAuthRequest(input) || response.status === 204) {
      return response;
    }

    const contentType = (response.headers.get("content-type") ?? "").toLowerCase();

    if (!contentType.includes("application/json")) {
      const preview = await response
        .clone()
        .text()
        .then((value) => value.trim().slice(0, 160))
        .catch(() => "");

      throw new Error(
        `Supabase auth returned a non-JSON response (${response.status}).${preview ? ` ${preview}` : ""}`
      );
    }

    try {
      await response.clone().json();
    } catch {
      throw new Error(`Supabase auth returned invalid JSON (${response.status}).`);
    }

    return response;
  };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMessage: string, timeoutMs = SUPABASE_AUTH_TIMEOUT_MS) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
      })
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: Parameters<typeof response.cookies.set>[2] }>) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({
            request
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        }
      },
      global: {
        fetch: createMiddlewareSupabaseFetch()
      }
    }
  );

  const pathname = request.nextUrl.pathname;
  const guestOnlyAuthPaths = ["/login", "/signup"];
  const premiumTrialPaths = ["/dashboard/websites/add", "/dashboard/branding"];
  let user: { id: string } | null = null;

  try {
    const {
      data: { session }
    } = await withTimeout(
      supabase.auth.getSession(),
      `Supabase auth session lookup timed out after ${SUPABASE_AUTH_TIMEOUT_MS}ms.`
    );

    user = session?.user ?? null;
  } catch (error) {
    console.error("Middleware auth lookup failed; allowing request to continue.", error);
    return response;
  }

  if (pathname.startsWith("/dashboard") && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && guestOnlyAuthPaths.some((path) => pathname.startsWith(path))) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.searchParams.delete("next");
    return NextResponse.redirect(url);
  }

  if (
    user &&
    premiumTrialPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`))
  ) {
    const { data: profile } = await supabase
      .from("users")
      .select("plan, subscription_status, is_trial, trial_ends_at")
      .eq("id", user.id)
      .single();

    if (profile && !hasActivePaidPlan(profile) && isTrialExpired(profile)) {
      if (pathname === "/dashboard/websites/add") {
        const { count } = await supabase
          .from("websites")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id);

        if ((count ?? 0) < 1) {
          return response;
        }
      }

      const url = request.nextUrl.clone();
      url.pathname = "/dashboard/billing";
      url.searchParams.set("trial", "expired");
      return NextResponse.redirect(url);
    }
  }

  return response;
}
