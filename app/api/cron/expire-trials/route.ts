import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const admin = createSupabaseAdminClient();

  const { error } = await admin
    .from("users")
    .update({
      plan: "free",
      is_trial: false
    })
    .eq("is_trial", true)
    .eq("plan", "free")
    .lt("trial_ends_at", new Date().toISOString());

  if (error) {
    return Response.json({ success: false, error: error.message });
  }

  return Response.json({ success: true });
}
