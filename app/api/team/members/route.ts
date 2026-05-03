import { apiError, apiSuccess, requireApiUser } from "@/lib/api";
import { getTeamAccessEntries } from "@/lib/team-access";
import { resolveWorkspaceContext } from "@/lib/workspace";

export async function GET() {
  const { profile, errorResponse } = await requireApiUser();
  if (errorResponse || !profile) {
    return errorResponse;
  }

  const workspace = await resolveWorkspaceContext(profile);
  if (!workspace.isOwner) {
    return apiError("Only the workspace owner can manage team access.", 403);
  }

  try {
    const entries = await getTeamAccessEntries(workspace.workspaceOwnerId);
    return apiSuccess(entries);
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Unable to load team access.", 500);
  }
}
