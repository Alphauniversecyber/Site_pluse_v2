import { LoginForm } from "@/components/landing/auth-forms";
import { redirectIfAuthenticated } from "@/lib/supabase-server";

export default async function LoginPage({
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
          {isPreviewUnlock ? "Unlock your scan" : "Client retention workflow"}
        </p>
        <h1 className="mt-4 font-display text-4xl font-semibold">
          {isPreviewUnlock
            ? "Log back in and open the full client-ready report instantly."
            : "Stay ahead of client risk without rebuilding the proof every week."}
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
        <LoginForm nextPath={searchParams.next ?? "/dashboard"} />
      </div>
    </main>
  );
}
