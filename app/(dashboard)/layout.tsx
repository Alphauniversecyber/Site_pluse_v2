import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { TrialBanner } from "@/components/trial/TrialBanner";
import { createSupabaseServerClient, requireAuthenticatedUser } from "@/lib/supabase-server";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireAuthenticatedUser();
  const supabase = createSupabaseServerClient();
  const { data: notifications } = await supabase
    .from("notifications")
    .select("id,user_id,website_id,type,title,body,is_read,severity,metadata,created_at")
    .order("created_at", { ascending: false })
    .limit(8);

  return (
    <DashboardShell
      profile={profile}
      notifications={notifications ?? []}
      topBanner={<TrialBanner profile={profile} />}
    >
      {children}
    </DashboardShell>
  );
}
