import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

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

  try {
    if (code) {
      await supabase.auth.exchangeCodeForSession(code);
    } else if (tokenHash && type === "recovery") {
      await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: "recovery"
      });
    }
  } catch {
    return NextResponse.redirect(new URL("/reset-password?error=recovery-link", url.origin));
  }

  return response;
}
