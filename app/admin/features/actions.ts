"use server";

import { redirect } from "next/navigation";

import { requireAdminPageAccess } from "@/lib/admin/auth";
import { saveAdminFeatureConfig } from "@/lib/admin/feature-flags";
import { normalizeFeaturePackages } from "@/lib/features";
import type { WorkspaceFeatureKey } from "@/types";

function buildRedirectUrl(ok: boolean, message: string) {
  const params = new URLSearchParams({
    actionStatus: ok ? "success" : "failed",
    actionMessage: message
  });

  return `/admin/features?${params.toString()}`;
}

export async function saveAdminFeatureSettings(formData: FormData) {
  requireAdminPageAccess();

  const key = String(formData.get("key") ?? "").trim() as WorkspaceFeatureKey;
  const enabled = formData.get("enabled") === "on";
  const allowedPackages = normalizeFeaturePackages(formData.getAll("allowedPackages"));

  try {
    if (!key) {
      throw new Error("Missing feature key.");
    }

    await saveAdminFeatureConfig({
      key,
      enabled,
      allowedPackages
    });

    redirect(buildRedirectUrl(true, "Feature settings updated."));
  } catch (error) {
    redirect(
      buildRedirectUrl(
        false,
        error instanceof Error ? error.message : "Unable to update feature settings."
      )
    );
  }
}
