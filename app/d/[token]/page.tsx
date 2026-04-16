import { SitePulseLogo } from "@/components/brand/sitepulse-logo";
import { TabNav } from "@/components/client-dashboard/TabNav";
import { buildClientDashboardPayload } from "@/lib/client-token";

export const dynamic = "force-dynamic";

export default async function ClientDashboardPage({
  params,
  searchParams
}: {
  params: { token: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const payload = await buildClientDashboardPayload(params.token);

  if (!payload) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
        <div className="w-full max-w-lg rounded-[2rem] border border-border/70 bg-card/90 p-8 text-center shadow-[0_30px_80px_-44px_rgba(15,23,42,0.35)] backdrop-blur-2xl">
          <div className="mx-auto flex w-fit rounded-2xl border border-border bg-background/80 px-4 py-3">
            <span className="dark:hidden">
              <SitePulseLogo variant="dark" className="h-8 w-[140px]" priority />
            </span>
            <span className="hidden dark:inline-flex">
              <SitePulseLogo variant="light" className="h-8 w-[140px]" priority />
            </span>
          </div>
          <p className="mt-8 font-display text-3xl font-semibold">This link is invalid or has expired</p>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Ask your agency contact to send you a fresh SitePulse dashboard link.
          </p>
        </div>
      </div>
    );
  }

  const gscState = Array.isArray(searchParams?.gsc) ? searchParams?.gsc[0] : searchParams?.gsc;
  const gaState = Array.isArray(searchParams?.ga) ? searchParams?.ga[0] : searchParams?.ga;
  const connectionNotice =
    gscState === "connected" && payload.connections.gsc
      ? "gsc_connected"
      : gaState === "connected" && payload.connections.ga
        ? "ga_connected"
        : gscState === "connected"
          ? "gsc_pending"
          : gaState === "connected"
            ? "ga_pending"
        : gscState === "needs-property"
          ? "gsc_needs_property"
          : gaState === "needs-property"
            ? "ga_needs_property"
            : null;

  return <TabNav dashboard={payload} connectionNotice={connectionNotice} />;
}
