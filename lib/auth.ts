import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { hasActivePaidPlan, isTrialExpired } from "@/lib/trial";

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
      }
    }
  );

  const {
    data: { user }
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const guestOnlyAuthPaths = ["/login", "/signup"];
  const premiumTrialPaths = ["/dashboard/websites/add", "/dashboard/branding"];

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
