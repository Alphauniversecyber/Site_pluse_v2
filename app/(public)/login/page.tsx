import type { Metadata } from "next";

import { LoginForm } from "@/components/landing/auth-forms";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-json-ld";
import { PUBLIC_SITE_URL, trimMetaDescription } from "@/lib/seo";
import { redirectIfAuthenticated } from "@/lib/supabase-server";

const LOGIN_URL = `${PUBLIC_SITE_URL}/login`;

export const metadata: Metadata = {
  title: "Login to Your SEO Audit Dashboard",
  description: trimMetaDescription(
    "Log in to SitePulse to access your agency SEO audit dashboard, client reports, alerts, and website monitoring workspace in one place."
  ),
  alternates: {
    canonical: LOGIN_URL
  }
};

export default async function LoginPage({
  searchParams
}: {
  searchParams: { next?: string; error?: string };
}) {
  await redirectIfAuthenticated(searchParams.next ?? "/dashboard");
  const isPreviewUnlock = (searchParams.next ?? "").startsWith("/unlock-preview/");

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", item: `${PUBLIC_SITE_URL}/` },
          { name: "Login", item: LOGIN_URL }
        ]}
      />
      <main className="container grid gap-10 py-10 md:py-16 lg:min-h-[calc(100vh-8rem)] lg:grid-cols-[1fr_28rem] lg:items-center">
        <div className="theme-panel order-2 rounded-[2rem] p-6 lg:order-1">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
            {isPreviewUnlock ? "Unlock your scan" : "Client retention workflow"}
          </p>
          <h1 className="mt-4 font-display text-4xl font-semibold">
            {isPreviewUnlock
              ? "Log in to unlock your free SEO audit report instantly."
              : "Log in to your SitePulse SEO audit dashboard."}
          </h1>
          <div className="mt-6 space-y-4 text-sm text-muted-foreground">
            {isPreviewUnlock ? (
              <>
                <p>
                  Your free scan is waiting. Login now and SitePulse will attach it to your workspace so you can continue from the unlocked report.
                </p>
                <p>
                  This keeps the pitch moving without asking you to start over or rebuild the client context manually.
                </p>
              </>
            ) : (
              <>
                <p>Walk back into a workspace built for account protection, client reporting, and clear proof of the value your agency is delivering.</p>
                <p>Use alerts, business-impact framing, and premium reports to stay proactive before clients ask what changed or what you fixed.</p>
              </>
            )}
          </div>
        </div>
        <div className="order-1 lg:order-2">
          <LoginForm
            nextPath={searchParams.next ?? "/dashboard"}
            authError={searchParams.error === "auth"}
          />
        </div>
      </main>
    </>
  );
}
