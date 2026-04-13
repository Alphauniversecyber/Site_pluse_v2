import "server-only";

import { createClient } from "@supabase/supabase-js";

function noStoreFetch(input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) {
  return fetch(input, {
    ...init,
    cache: "no-store"
  });
}

export function createSupabaseAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      global: {
        fetch: noStoreFetch
      }
    }
  );
}
