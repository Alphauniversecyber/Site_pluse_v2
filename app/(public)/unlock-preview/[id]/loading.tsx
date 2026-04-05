export default function UnlockPreviewLoading() {
  return (
    <main className="container flex min-h-[calc(100vh-12rem)] items-center justify-center py-20">
      <div className="max-w-xl rounded-[2rem] border border-border bg-card/80 p-8 text-center shadow-[0_28px_80px_-42px_rgba(15,23,42,0.28)]">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Unlocking report</p>
        <h1 className="mt-4 font-display text-3xl font-semibold">Preparing the full client-ready report</h1>
        <p className="mt-4 text-sm leading-7 text-muted-foreground">
          We&apos;re attaching your free scan to the new workspace so you can see the full result immediately.
        </p>
      </div>
    </main>
  );
}
