import { runLoggedCron } from "@/lib/admin/logging";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  try {
    const expiredCount = await runLoggedCron("expire-trials", async () => {
      const { data, error } = await admin
        .from("users")
        .update({
          plan: "free",
          billing_cycle: null,
          subscription_price: null,
          subscription_status: "inactive",
          is_trial: false
        })
        .eq("is_trial", true)
        .lt("trial_ends_at", new Date().toISOString())
        .select("id");

      if (error) {
        throw new Error(error.message);
      }

      return (data ?? []).length;
    });

    return Response.json({ success: true, count: expiredCount });
  } catch (error) {
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : "Unable to expire trials."
    });
  }
}
