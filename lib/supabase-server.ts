import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";

import type { UserProfile } from "@/types";

export function createSupabaseServerClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: ReturnType<typeof cookies>["set"] extends (...args: infer T) => any ? T[2] : never }>) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Server Components cannot always mutate cookies during render.
          }
        }
      }
    }
  );
}

export async function getCurrentUserProfile() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, profile: null };
  }

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single<UserProfile>();

  return { user, profile: profile ?? null };
}

export async function requireAuthenticatedUser() {
  const { user, profile } = await getCurrentUserProfile();

  if (!user || !profile) {
    redirect("/login");
  }

  return { user, profile };
}

export async function redirectIfAuthenticated(pathname = "/dashboard") {
  const { user } = await getCurrentUserProfile();

  if (user) {
    redirect(pathname);
  }
}
