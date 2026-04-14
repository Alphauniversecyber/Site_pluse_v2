import { redirectAdminIfAuthenticated } from "@/lib/admin/auth";

export default async function AdminLoginPage({
  searchParams
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  redirectAdminIfAuthenticated();

  const error = Array.isArray(searchParams?.error) ? searchParams?.error[0] : searchParams?.error;
  const config = Array.isArray(searchParams?.config) ? searchParams?.config[0] : searchParams?.config;

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-[2rem] border border-[#222222] bg-[#111111] p-8 shadow-[0_25px_60px_rgba(0,0,0,0.45)]">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#22C55E]">Ranula only</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">Admin Login</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          Enter the internal admin secret to open the SitePulse operations dashboard.
        </p>

        {config === "missing" ? (
          <div className="mt-5 rounded-2xl border border-[#78350F] bg-[#2A1908] px-4 py-3 text-sm text-[#FCD34D]">
            ADMIN_SECRET is not configured yet.
          </div>
        ) : null}

        {error === "invalid" ? (
          <div className="mt-5 rounded-2xl border border-[#7F1D1D] bg-[#2A1010] px-4 py-3 text-sm text-[#FCA5A5]">
            The password was incorrect. Try again.
          </div>
        ) : null}

        <form action="/api/admin/auth" method="post" className="mt-6 space-y-4">
          <div>
            <label htmlFor="password" className="mb-2 block text-sm font-medium text-zinc-200">
              Admin password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="w-full rounded-2xl border border-[#2A2A2A] bg-[#0B0B0B] px-4 py-3 text-sm text-white outline-none transition focus:border-[#22C55E]"
              placeholder="Enter ADMIN_SECRET"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-2xl bg-[#22C55E] px-4 py-3 text-sm font-semibold text-black transition hover:bg-[#34D46C]"
          >
            Login
          </button>
        </form>
      </div>
    </div>
  );
}
