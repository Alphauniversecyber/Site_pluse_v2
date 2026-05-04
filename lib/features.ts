import type { UserProfile, WorkspaceFeatureConfig, WorkspaceFeatureKey, WorkspaceFeaturePackage } from "@/types";
import { isTrialActive } from "@/lib/trial";

export const WORKSPACE_FEATURE_PACKAGES: WorkspaceFeaturePackage[] = [
  "trial",
  "free",
  "growth",
  "pro"
];

export const WORKSPACE_FEATURE_DEFAULTS: Record<WorkspaceFeatureKey, WorkspaceFeatureConfig> = {
  client_dashboard: {
    key: "client_dashboard",
    enabled: true,
    allowedPackages: [...WORKSPACE_FEATURE_PACKAGES],
    updatedAt: null
  }
};

export function normalizeFeaturePackages(value: unknown): WorkspaceFeaturePackage[] {
  if (!Array.isArray(value)) {
    return [...WORKSPACE_FEATURE_PACKAGES];
  }

  const normalized = value.filter((item): item is WorkspaceFeaturePackage =>
    typeof item === "string" && WORKSPACE_FEATURE_PACKAGES.includes(item as WorkspaceFeaturePackage)
  );

  return normalized.length ? normalized : [...WORKSPACE_FEATURE_PACKAGES];
}

export function getWorkspaceFeaturePackage(
  profile: Pick<UserProfile, "plan" | "is_trial" | "trial_ends_at">
): WorkspaceFeaturePackage {
  if (isTrialActive(profile)) {
    return "trial";
  }

  if (profile.plan === "agency") {
    return "pro";
  }

  if (profile.plan === "starter") {
    return "growth";
  }

  return "free";
}

export function isWorkspaceFeatureEnabled(
  config: WorkspaceFeatureConfig,
  profile: Pick<UserProfile, "plan" | "is_trial" | "trial_ends_at">
) {
  if (!config.enabled) {
    return false;
  }

  const currentPackage = getWorkspaceFeaturePackage(profile);
  return config.allowedPackages.includes(currentPackage);
}
