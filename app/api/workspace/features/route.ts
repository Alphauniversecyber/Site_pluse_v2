import { apiSuccess, requireApiUser } from "@/lib/api";
import { getAdminFeatureConfigs } from "@/lib/admin/feature-flags";
import { getWorkspaceFeaturePackage, isWorkspaceFeatureEnabled } from "@/lib/features";
import { resolveWorkspaceContext } from "@/lib/workspace";

export async function GET() {
  const { profile, errorResponse } = await requireApiUser();
  if (errorResponse || !profile) {
    return errorResponse;
  }

  const workspace = await resolveWorkspaceContext(profile);
  const configs = await getAdminFeatureConfigs();
  const currentPackage = getWorkspaceFeaturePackage(workspace.workspaceProfile);
  const features = Object.fromEntries(
    configs.map((config) => [config.key, isWorkspaceFeatureEnabled(config, workspace.workspaceProfile)])
  ) as Record<(typeof configs)[number]["key"], boolean>;

  return apiSuccess({
    currentPackage,
    features,
    configs
  });
}
