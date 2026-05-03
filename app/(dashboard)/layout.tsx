import { WorkspaceProvider } from "@/components/dashboard/workspace-provider";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { TrialBanner } from "@/components/trial/TrialBanner";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { requireAuthenticatedUser } from "@/lib/supabase-server";
import { resolveWorkspaceContext } from "@/lib/workspace";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireAuthenticatedUser();
  const workspace = await resolveWorkspaceContext(profile);
  const admin = createSupabaseAdminClient();
  const { data: notifications } = await admin
    .from("notifications")
    .select("id,user_id,website_id,type,title,body,is_read,severity,metadata,created_at")
    .eq("user_id", workspace.workspaceOwnerId)
    .order("created_at", { ascending: false })
    .limit(8);

  return (
    <WorkspaceProvider
      initialState={{
        activeWorkspace: workspace.activeWorkspace,
        workspaces: workspace.availableWorkspaces,
        workspaceProfile: workspace.workspaceProfile
      }}
    >
      <DashboardShell
        profile={profile}
        notifications={notifications ?? []}
        topBanner={
          <TrialBanner
            profile={workspace.workspaceProfile}
            canManageBilling={workspace.isOwner}
          />
        }
      >
        {children}
      </DashboardShell>
    </WorkspaceProvider>
  );
}
