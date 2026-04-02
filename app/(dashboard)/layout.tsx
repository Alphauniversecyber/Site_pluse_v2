import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { createSupabaseServerClient, requireAuthenticatedUser } from "@/lib/supabase-server";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireAuthenticatedUser();
  const supabase = createSupabaseServerClient();
  const { data: notifications } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(8);

  return (
    <DashboardShell profile={profile} notifications={notifications ?? []}>
      {children}
    </DashboardShell>
  );
}
