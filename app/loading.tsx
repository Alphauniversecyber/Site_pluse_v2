export default function RootLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground transition-colors duration-300">
      <div className="space-y-4 text-center">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-muted border-t-primary" />
        <p className="text-sm text-muted-foreground">Loading SitePulse...</p>
      </div>
    </div>
  );
}
