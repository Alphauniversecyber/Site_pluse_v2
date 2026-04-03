"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-background text-foreground">
        <main className="flex min-h-screen items-center justify-center px-6">
          <div className="w-full max-w-lg rounded-[2rem] border border-border bg-card p-8 text-center shadow-[0_24px_80px_-44px_rgba(15,23,42,0.45)]">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">
              Unexpected error
            </p>
            <h1 className="mt-4 font-display text-3xl font-semibold">
              Something went wrong while loading SitePulse
            </h1>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              Try the page again or head back to the dashboard.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Button onClick={reset}>Try again</Button>
              <Button variant="outline" onClick={() => (window.location.href = "/dashboard")}>
                Go to dashboard
              </Button>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
