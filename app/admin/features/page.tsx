import { AdminCard } from "@/components/admin/admin-card";
import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { requireAdminPageAccess } from "@/lib/admin/auth";
import { getAdminFeatureConfigs } from "@/lib/admin/feature-flags";
import { WORKSPACE_FEATURE_PACKAGES } from "@/lib/features";
import { saveAdminFeatureSettings } from "@/app/admin/features/actions";

const PACKAGE_LABELS = {
  trial: "Trial",
  free: "Free",
  growth: "Growth",
  pro: "Pro"
} as const;

function statusNotice(status: string | undefined, message: string | undefined) {
  if (!status || !message) {
    return null;
  }

  return (
    <div
      className={`mb-6 rounded-2xl border px-4 py-3 text-sm ${
        status === "success"
          ? "border-[#14532D] bg-[#052E16] text-[#86EFAC]"
          : "border-[#7F1D1D] bg-[#2A1010] text-[#FCA5A5]"
      }`}
    >
      {message}
    </div>
  );
}

export default async function AdminFeaturesPage({
  searchParams
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  requireAdminPageAccess();

  const configs = await getAdminFeatureConfigs();
  const status = Array.isArray(searchParams?.actionStatus)
    ? searchParams?.actionStatus[0]
    : searchParams?.actionStatus;
  const message = Array.isArray(searchParams?.actionMessage)
    ? searchParams?.actionMessage[0]
    : searchParams?.actionMessage;

  return (
    <div>
      <AdminPageHeader
        title="Features"
        description="Turn workspace-facing features on or off and decide which account packages can see them."
      />

      {statusNotice(status, message)}

      {configs.length ? (
        <div className="space-y-6">
          {configs.map((config) => (
            <AdminCard key={config.key}>
              <form action={saveAdminFeatureSettings} className="space-y-6">
                <input type="hidden" name="key" value={config.key} />

                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#22C55E]">
                      Workspace feature
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold text-white">
                      Client Dashboard
                    </h2>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
                      Controls whether users can see client dashboard controls in website details and branding-related client dashboard options.
                    </p>
                  </div>

                  <label className="flex items-center gap-3 rounded-2xl border border-[#2A2A2A] bg-[#0B0B0B] px-4 py-3 text-sm text-zinc-200">
                    <input
                      type="checkbox"
                      name="enabled"
                      defaultChecked={config.enabled}
                      className="h-4 w-4 rounded border-[#3A3A3A] bg-transparent text-[#22C55E] focus:ring-[#22C55E]"
                    />
                    <span>Enabled</span>
                  </label>
                </div>

                <div>
                  <p className="text-sm font-medium text-white">Visible for packages</p>
                  <p className="mt-1 text-sm text-zinc-400">
                    Only the selected packages will see this feature when it is enabled.
                  </p>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {WORKSPACE_FEATURE_PACKAGES.map((item) => (
                      <label
                        key={item}
                        className="flex items-center gap-3 rounded-2xl border border-[#2A2A2A] bg-[#0B0B0B] px-4 py-3 text-sm text-zinc-200"
                      >
                        <input
                          type="checkbox"
                          name="allowedPackages"
                          value={item}
                          defaultChecked={config.allowedPackages.includes(item)}
                          className="h-4 w-4 rounded border-[#3A3A3A] bg-transparent text-[#22C55E] focus:ring-[#22C55E]"
                        />
                        <span>{PACKAGE_LABELS[item]}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 rounded-2xl border border-[#1F1F1F] bg-[#0D0D0D] px-4 py-4">
                  <div>
                    <p className="text-sm font-medium text-white">Current rule</p>
                    <p className="mt-1 text-sm text-zinc-400">
                      {config.enabled
                        ? `Shown to: ${config.allowedPackages
                            .map((item) => PACKAGE_LABELS[item])
                            .join(", ")}`
                        : "Hidden for every package."}
                    </p>
                  </div>
                  <button
                    type="submit"
                    className="rounded-2xl bg-[#22C55E] px-4 py-3 text-sm font-semibold text-black"
                  >
                    Save feature
                  </button>
                </div>
              </form>
            </AdminCard>
          ))}
        </div>
      ) : (
        <AdminEmptyState
          title="No feature flags found"
          description="Create the admin feature flag records to start controlling workspace-facing features."
        />
      )}
    </div>
  );
}
