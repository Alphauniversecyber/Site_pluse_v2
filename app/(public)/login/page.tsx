import { LoginForm } from "@/components/landing/auth-forms";
import { redirectIfAuthenticated } from "@/lib/supabase-server";

export default async function LoginPage({
  searchParams
}: {
  searchParams: { next?: string };
}) {
  await redirectIfAuthenticated();

  return (
    <main className="container grid gap-10 py-10 md:py-16 lg:min-h-[calc(100vh-8rem)] lg:grid-cols-[1fr_28rem] lg:items-center">
      <div className="theme-panel order-2 rounded-[2rem] p-6 lg:order-1">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Why teams log in daily</p>
        <h1 className="mt-4 font-display text-4xl font-semibold">Stay ahead of client site issues without chasing reports manually.</h1>
        <div className="mt-6 space-y-4 text-sm text-muted-foreground">
          <p>Monitor performance, accessibility, SEO, and score regressions across every client website you manage.</p>
          <p>Keep stakeholders informed with scheduled reports, alerts, and branded deliverables that look polished on every screen size.</p>
        </div>
      </div>
      <div className="order-1 lg:order-2">
        <LoginForm nextPath={searchParams.next ?? "/dashboard"} />
      </div>
    </main>
  );
}
