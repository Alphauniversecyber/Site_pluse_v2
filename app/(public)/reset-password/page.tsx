import { ResetPasswordForm } from "@/components/landing/auth-forms";

export default function ResetPasswordPage() {
  return (
    <main className="container grid gap-10 py-10 md:py-16 lg:min-h-[calc(100vh-8rem)] lg:grid-cols-[1fr_28rem] lg:items-center">
      <div className="theme-panel order-2 rounded-[2rem] p-6 lg:order-1">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Secure recovery</p>
        <h1 className="mt-4 font-display text-4xl font-semibold">Recover access without losing momentum in your client workflow.</h1>
        <div className="mt-6 space-y-4 text-sm text-muted-foreground">
          <p>Reset your password securely and get back to monitoring sites, reviewing scans, and sending branded reports.</p>
          <p>Recovery links are sent directly to the email address on your SitePulse workspace.</p>
        </div>
      </div>
      <div className="order-1 lg:order-2">
        <ResetPasswordForm />
      </div>
    </main>
  );
}
