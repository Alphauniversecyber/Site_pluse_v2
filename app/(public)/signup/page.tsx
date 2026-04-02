import { SignupForm } from "@/components/landing/auth-forms";
import { redirectIfAuthenticated } from "@/lib/supabase-server";

export default async function SignupPage() {
  await redirectIfAuthenticated();

  return (
    <main className="container grid gap-10 py-10 md:py-16 lg:min-h-[calc(100vh-8rem)] lg:grid-cols-[1fr_28rem] lg:items-center">
      <div className="theme-panel order-2 rounded-[2rem] p-6 lg:order-1">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Built for agencies</p>
        <h1 className="mt-4 font-display text-4xl font-semibold">Start with one site free, then scale when client reporting becomes repeatable.</h1>
        <div className="mt-6 space-y-4 text-sm text-muted-foreground">
          <p>Set up a workspace, connect your first website, and see how SitePulse handles monitoring and reporting without adding another manual weekly task.</p>
          <p>Upgrade later for white-label reports, daily scanning, more websites, and agency-ready branding controls.</p>
        </div>
      </div>
      <div className="order-1 lg:order-2">
        <SignupForm />
      </div>
    </main>
  );
}
