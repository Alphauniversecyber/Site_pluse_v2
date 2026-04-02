import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="max-w-md rounded-3xl border border-border bg-card p-10 text-center shadow-xl">
        <p className="font-display text-sm uppercase tracking-[0.32em] text-primary">404</p>
        <h1 className="mt-4 font-display text-3xl font-semibold">Page not found</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          The page you were looking for has moved or does not exist.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}
