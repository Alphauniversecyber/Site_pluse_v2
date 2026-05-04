import "server-only";

import type { WorkspaceFeatureConfig, WorkspaceFeatureKey } from "@/types";
import { WORKSPACE_FEATURE_DEFAULTS, normalizeFeaturePackages } from "@/lib/features";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type FeatureFlagRow = {
  key: WorkspaceFeatureKey;
  enabled: boolean;
  allowed_packages: unknown;
  updated_at: string | null;
};

function isMissingFeatureTableError(message: string | null | undefined) {
  return /admin_feature_flags/i.test(message ?? "") && /does not exist/i.test(message ?? "");
}

function mapRowToConfig(row: FeatureFlagRow): WorkspaceFeatureConfig {
  return {
    key: row.key,
    enabled: row.enabled,
    allowedPackages: normalizeFeaturePackages(row.allowed_packages),
    updatedAt: row.updated_at
  };
}

export async function getAdminFeatureConfigs() {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("admin_feature_flags")
    .select("key, enabled, allowed_packages, updated_at");

  if (error) {
    if (isMissingFeatureTableError(error.message)) {
      return Object.values(WORKSPACE_FEATURE_DEFAULTS);
    }

    throw new Error(error.message);
  }

  const rows = (data ?? []) as FeatureFlagRow[];
  const mapped = new Map<WorkspaceFeatureKey, WorkspaceFeatureConfig>(
    Object.values(WORKSPACE_FEATURE_DEFAULTS).map((config) => [config.key, config])
  );

  for (const row of rows) {
    mapped.set(row.key, mapRowToConfig(row));
  }

  return Array.from(mapped.values());
}

export async function getAdminFeatureConfig(key: WorkspaceFeatureKey) {
  const configs = await getAdminFeatureConfigs();
  return configs.find((config) => config.key === key) ?? WORKSPACE_FEATURE_DEFAULTS[key];
}

export async function saveAdminFeatureConfig(config: WorkspaceFeatureConfig) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("admin_feature_flags")
    .upsert(
      {
        key: config.key,
        enabled: config.enabled,
        allowed_packages: config.allowedPackages
      },
      {
        onConflict: "key"
      }
    )
    .select("key, enabled, allowed_packages, updated_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapRowToConfig(data as FeatureFlagRow);
}
