"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import type { Route } from "next";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema
} from "@/lib/validation";

function FieldMessage({ error, hint }: { error?: string; hint?: string }) {
  return (
    <p className={cn("text-sm", error ? "text-rose-400" : "text-muted-foreground")}>
      {error ?? hint}
    </p>
  );
}

function buildAuthHref(pathname: "/login" | "/signup", nextPath: string): Route {
  if (nextPath === "/dashboard") {
    return pathname;
  }

  return `${pathname}?next=${encodeURIComponent(nextPath)}` as Route;
}

function buildAuthCallbackUrl(nextPath: string) {
  const callback = new URL("/auth/callback", window.location.origin);
  callback.searchParams.set("next", nextPath);
  return callback.toString();
}

function triggerLocationTracking() {
  void fetch("/api/auth/track-location", {
    method: "POST"
  }).catch(() => undefined);
}

export function LoginForm({ nextPath = "/dashboard" }: { nextPath?: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const isPreviewUnlock = nextPath.startsWith("/unlock-preview/");
  const form = useForm({
    resolver: zodResolver(loginSchema),
    mode: "onChange",
    defaultValues: {
      email: "",
      password: ""
    }
  });

  return (
    <Card className="mx-auto w-full max-w-xl border-border bg-card/90 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.45)]">
      <CardHeader className="space-y-3 p-6 sm:p-8">
        <div className="inline-flex w-fit items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          {isPreviewUnlock ? "Unlock full report" : "Agency workspace login"}
        </div>
        <CardTitle className="text-3xl">
          {isPreviewUnlock ? "Log in to unlock the full client report" : "Login to SitePulse"}
        </CardTitle>
        <CardDescription className="text-base">
          {isPreviewUnlock
            ? "Access the full score breakdown, client-ready insights, and follow-up actions without losing the free scan you just ran."
            : "Access your client acquisition workspace, reports, and alerts with the same account you use for billing."}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6 pt-0 sm:px-8 sm:pb-8">
        <form
          className="space-y-5"
          onSubmit={form.handleSubmit(async (values: any) => {
            setSubmitting(true);
            const supabase = createSupabaseBrowserClient();
            const { error } = await supabase.auth.signInWithPassword(values);
            setSubmitting(false);

            if (error) {
              toast.error(error.message);
              return;
            }

            triggerLocationTracking();
            toast.success("Welcome back.");
            window.location.href = nextPath;
          })}
        >
          <div className="space-y-2.5">
            <Label htmlFor="login-email">Email</Label>
            <Input
              id="login-email"
              type="email"
              placeholder="you@agency.com"
              aria-invalid={Boolean(form.formState.errors.email)}
              {...form.register("email")}
            />
            <FieldMessage
              error={form.formState.errors.email?.message}
              hint="Use the email connected to your SitePulse workspace."
            />
          </div>
          <div className="space-y-2.5">
            <Label htmlFor="login-password">Password</Label>
            <PasswordInput
              id="login-password"
              placeholder="Enter your password"
              aria-invalid={Boolean(form.formState.errors.password)}
              {...form.register("password")}
            />
            <FieldMessage
              error={form.formState.errors.password?.message}
              hint="Passwords must be at least 8 characters."
            />
          </div>
          <Button className="w-full" type="submit" disabled={submitting} aria-busy={submitting}>
            {submitting ? "Logging in..." : "Login"}
          </Button>
          <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <Link href="/reset-password" className="text-primary transition hover:underline">
              Forgot your password?
            </Link>
            <p className="text-muted-foreground">
              New here?{" "}
              <Link
                href={buildAuthHref("/signup", nextPath)}
                className="text-primary transition hover:underline"
              >
                Create a free account
              </Link>
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function SignupForm({ nextPath = "/dashboard" }: { nextPath?: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const isPreviewUnlock = nextPath.startsWith("/unlock-preview/");
  const form = useForm({
    resolver: zodResolver(signupSchema),
    mode: "onChange",
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: ""
    }
  });

  return (
    <Card className="mx-auto w-full max-w-xl border-border bg-card/90 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.45)]">
      <CardHeader className="space-y-3 p-6 sm:p-8">
        <div className="inline-flex w-fit items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          {isPreviewUnlock ? "Unlock full report" : "Agency growth signup"}
        </div>
        <CardTitle className="text-3xl">
          {isPreviewUnlock ? "Create your free account to unlock the full report" : "Create your free SitePulse account"}
        </CardTitle>
        <CardDescription className="text-base">
          {isPreviewUnlock
            ? "Keep the scan you already ran, unlock the full client-ready report, and turn it into an agency-grade follow-up immediately."
            : "Start with one site free, then upgrade when the workflow starts helping you win and retain more client work."}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6 pt-0 sm:px-8 sm:pb-8">
        <form
          className="space-y-5"
          onSubmit={form.handleSubmit(async (values: any) => {
            setSubmitting(true);
            const supabase = createSupabaseBrowserClient();
            const { data, error } = await supabase.auth.signUp({
              email: values.email,
              password: values.password,
              options: {
                emailRedirectTo: buildAuthCallbackUrl(nextPath),
                data: {
                  full_name: values.fullName,
                  agency_name: values.fullName
                }
              }
            });
            setSubmitting(false);

            if (error) {
              toast.error(error.message);
              return;
            }

            triggerLocationTracking();

            if (data.session) {
              toast.success("Account created.");
              router.push(nextPath as Route);
              router.refresh();
              return;
            }

            toast.success("Account created. Check your inbox to confirm your email.");
            router.push(buildAuthHref("/login", nextPath));
          })}
        >
          <div className="space-y-2.5">
            <Label htmlFor="signup-name">Full name</Label>
            <Input
              id="signup-name"
              placeholder="Sarah from Studio North"
              aria-invalid={Boolean(form.formState.errors.fullName)}
              {...form.register("fullName")}
            />
            <FieldMessage
              error={form.formState.errors.fullName?.message}
              hint="This is used for your workspace and email sender name by default."
            />
          </div>
          <div className="space-y-2.5">
            <Label htmlFor="signup-email">Email</Label>
            <Input
              id="signup-email"
              type="email"
              placeholder="you@agency.com"
              aria-invalid={Boolean(form.formState.errors.email)}
              {...form.register("email")}
            />
            <FieldMessage
              error={form.formState.errors.email?.message}
              hint="Use your agency email so invites, reports, and billing stay in one place."
            />
          </div>
          <div className="space-y-2.5">
            <Label htmlFor="signup-password">Password</Label>
            <PasswordInput
              id="signup-password"
              placeholder="At least 8 characters"
              aria-invalid={Boolean(form.formState.errors.password)}
              {...form.register("password")}
            />
            <FieldMessage
              error={form.formState.errors.password?.message}
              hint="Choose a password with at least 8 characters."
            />
          </div>

          <div className="space-y-2.5">
            <Label htmlFor="signup-confirm-password">Confirm password</Label>
            <PasswordInput
              id="signup-confirm-password"
              placeholder="Re-enter your password"
              aria-invalid={Boolean(form.formState.errors.confirmPassword)}
              {...form.register("confirmPassword")}
            />
            <FieldMessage
              error={form.formState.errors.confirmPassword?.message}
              hint="Re-enter the same password to confirm your signup."
            />
          </div>

          <Button className="w-full" type="submit" disabled={submitting} aria-busy={submitting}>
            {submitting ? "Creating account..." : "Start Free - No Credit Card"}
          </Button>

          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              href={buildAuthHref("/login", nextPath)}
              className="text-primary transition hover:underline"
            >
              Log in
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

export function ResetPasswordForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const forgotForm = useForm({
    resolver: zodResolver(forgotPasswordSchema),
    mode: "onChange",
    defaultValues: {
      email: ""
    }
  });
  const resetForm = useForm({
    resolver: zodResolver(resetPasswordSchema),
    mode: "onChange",
    defaultValues: {
      password: "",
      confirmPassword: ""
    }
  });

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let active = true;

    async function hydrateRecoverySession() {
      const { data } = await supabase.auth.getSession();
      if (active && data.session) {
        setHasRecoverySession(true);
        return;
      }

      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const type = hash.get("type");
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");

      if (type === "recovery" && accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        });

        if (!error && active) {
          setHasRecoverySession(true);
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      }
    }

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event) => {
      if (!active) {
        return;
      }

      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setHasRecoverySession(true);
      }
    });

    void hydrateRecoverySession();

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <Card className="mx-auto w-full max-w-xl border-border bg-card/90 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.45)]">
      <CardHeader className="space-y-3 p-6 sm:p-8">
        <div className="inline-flex w-fit items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          Account recovery
        </div>
        <CardTitle className="text-3xl">{hasRecoverySession ? "Set a new password" : "Reset your password"}</CardTitle>
        <CardDescription>
          {hasRecoverySession
            ? "Choose a new password for your SitePulse account."
            : "We'll email you a secure recovery link."}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6 pt-0 sm:px-8 sm:pb-8">
        {hasRecoverySession ? (
          <form
            className="space-y-5"
            onSubmit={resetForm.handleSubmit(async (values: any) => {
              setSubmitting(true);
              const supabase = createSupabaseBrowserClient();
              const { error } = await supabase.auth.updateUser({
                password: values.password
              });
              setSubmitting(false);

              if (error) {
                toast.error(error.message);
                return;
              }

              toast.success("Password updated.");
              router.push("/dashboard/settings");
            })}
          >
            <div className="space-y-2.5">
              <Label htmlFor="reset-password">New password</Label>
              <PasswordInput
                id="reset-password"
                aria-invalid={Boolean(resetForm.formState.errors.password)}
                {...resetForm.register("password")}
              />
              <FieldMessage
                error={resetForm.formState.errors.password?.message}
                hint="Use at least 8 characters for your new password."
              />
            </div>
            <div className="space-y-2.5">
              <Label htmlFor="reset-confirm">Confirm password</Label>
              <PasswordInput
                id="reset-confirm"
                aria-invalid={Boolean(resetForm.formState.errors.confirmPassword)}
                {...resetForm.register("confirmPassword")}
              />
              <FieldMessage
                error={resetForm.formState.errors.confirmPassword?.message}
                hint="Re-enter your new password to confirm the change."
              />
            </div>
            <Button className="w-full" type="submit" disabled={submitting} aria-busy={submitting}>
              {submitting ? "Updating password..." : "Save new password"}
            </Button>
          </form>
        ) : (
          <form
            className="space-y-5"
            onSubmit={forgotForm.handleSubmit(async (values: any) => {
              setSubmitting(true);
              const supabase = createSupabaseBrowserClient();
              const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
                redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`
              });
              setSubmitting(false);

              if (error) {
                toast.error(error.message);
                return;
              }

              toast.success("Password reset email sent.");
            })}
          >
            <div className="space-y-2.5">
              <Label htmlFor="forgot-email">Email</Label>
              <Input
                id="forgot-email"
                type="email"
                placeholder="you@agency.com"
                aria-invalid={Boolean(forgotForm.formState.errors.email)}
                {...forgotForm.register("email")}
              />
              <FieldMessage
                error={forgotForm.formState.errors.email?.message}
                hint="We'll send the recovery link to this email address."
              />
            </div>
            <Button className="w-full" type="submit" disabled={submitting} aria-busy={submitting}>
              {submitting ? "Sending email..." : "Send reset email"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
