import type { Metadata } from "next";

import { ResetPasswordForm } from "@/components/landing/auth-forms";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-json-ld";
import { PUBLIC_SITE_URL, trimMetaDescription } from "@/lib/seo";

const RESET_PASSWORD_URL = `${PUBLIC_SITE_URL}/reset-password`;

export const metadata: Metadata = {
  title: "Reset Your SitePulse Password",
  description: trimMetaDescription(
    "Reset your SitePulse password securely and regain access to your agency SEO audit dashboard, client reports, and website monitoring workspace."
  ),
  alternates: {
    canonical: RESET_PASSWORD_URL
  }
};

export default function ResetPasswordPage({
  searchParams
}: {
  searchParams?: { error?: string };
}) {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", item: `${PUBLIC_SITE_URL}/` },
          { name: "Reset Password", item: RESET_PASSWORD_URL }
        ]}
      />
      <main className="container grid gap-10 py-10 md:py-16 lg:min-h-[calc(100vh-8rem)] lg:grid-cols-[1fr_28rem] lg:items-center">
        <div className="theme-panel order-2 rounded-[2rem] p-6 lg:order-1">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
            Password recovery
          </p>
          <h1 className="mt-4 font-display text-4xl font-semibold">
            Reset your SitePulse password.
          </h1>
          <div className="mt-6 space-y-4 text-sm text-muted-foreground">
            <p>
              Request a secure recovery link, then choose a new password without leaving the
              SitePulse flow.
            </p>
            <p>
              The recovery link now routes through a dedicated auth callback so it returns you to
              this reset screen instead of dropping you on the homepage.
            </p>
            {searchParams?.error ? (
              <p className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/20 dark:text-amber-200">
                That recovery link could not be verified. Request a new reset email and try again.
              </p>
            ) : null}
          </div>
        </div>
        <div className="order-1 lg:order-2">
          <ResetPasswordForm />
        </div>
      </main>
    </>
  );
}
