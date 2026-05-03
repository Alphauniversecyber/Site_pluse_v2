import type { Metadata } from "next";

import { SignupForm } from "@/components/landing/auth-forms";
import { redirectIfAuthenticated } from "@/lib/supabase-server";

export const metadata: Metadata = {
  title: "Start Your SEO Audit Free Trial",
  description:
    "Start your 14-day SitePulse free trial to run SEO audits, generate white-label client reports, and turn website findings into paying clients.",
  alternates: {
    canonical: "https://www.trysitepulse.com/signup"
  }
};

export default async function SignupPage({
  searchParams
}: {
  searchParams: { next?: string };
}) {
  await redirectIfAuthenticated(searchParams.next ?? "/dashboard");
  const isPreviewUnlock = (searchParams.next ?? "").startsWith("/unlock-preview/");

  return (
    <main className="container grid gap-10 py-10 md:py-16 lg:min-h-[calc(100vh-8rem)] lg:grid-cols-[1fr_28rem] lg:items-center">
      <div className="theme-panel order-2 rounded-[2rem] p-6 lg:order-1">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
          {isPreviewUnlock ? "Unlock your scan" : "Agency growth system"}
        </p>
        <h1 className="mt-4 font-display text-4xl font-semibold">
          {isPreviewUnlock
            ? "Sign up to unlock your free SEO audit report."
            : "Start your SitePulse SEO audit free trial."}
        </h1>
        <div className="mt-6 space-y-4 text-sm text-muted-foreground">
          {isPreviewUnlock ? (
            <>
              <p>
                Create the workspace now and SitePulse will attach the free scan to your account automatically, so you can walk straight into the full report.
              </p>
              <p>
                That means no empty dashboard and no lost momentum when you&apos;re already mid-pitch with a client.
              </p>
            </>
          ) : (
            <>
              <p>Create the workspace once, run a client-ready scan immediately, and turn technical findings into a sales and retention asset your team can reuse.</p>
              <p>Upgrade when you want more coverage, stronger white-label delivery, and a more scalable way to prove your agency&apos;s value every month.</p>
            </>
          )}
        </div>
      </div>
      <div className="order-1 lg:order-2">
        <SignupForm nextPath={searchParams.next ?? "/dashboard"} />
      </div>
    </main>
  );
}
