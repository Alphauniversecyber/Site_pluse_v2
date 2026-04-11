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
      <div className="flex min-h-screen items-center justify-center bg-[#0F172A] px-4 text-white">
        <div className="w-full max-w-lg rounded-[2rem] border border-white/10 bg-white/[0.05] p-8 text-center shadow-[0_30px_80px_-44px_rgba(15,23,42,0.85)] backdrop-blur-2xl">
          <div className="mx-auto flex w-fit rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3">
            <SitePulseLogo variant="light" className="h-8 w-[140px]" priority />
          </div>
          <p className="mt-8 font-display text-3xl font-semibold">This link is invalid or has expired</p>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Ask your agency contact to send you a fresh SitePulse dashboard link.
          </p>
        </div>
      </div>
    );
  }

  const gscState = Array.isArray(searchParams?.gsc) ? searchParams?.gsc[0] : searchParams?.gsc;
  const gaState = Array.isArray(searchParams?.ga) ? searchParams?.ga[0] : searchParams?.ga;
  const connectionNotice =
    gscState === "connected" ? "gsc" : gaState === "connected" ? "ga" : null;

  return <TabNav dashboard={payload} connectionNotice={connectionNotice} />;
}
