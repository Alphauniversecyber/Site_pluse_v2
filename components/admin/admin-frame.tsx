"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { Route } from "next";
import { Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ADMIN_SIDEBAR_LINKS } from "@/lib/admin/constants";

function AdminSidebarContent({
  pathname,
  onNavigate
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <>
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#22C55E]">Internal only</p>
        <h1 className="mt-3 text-2xl font-semibold text-white">SitePulse Admin</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Platform operations, billing, cron health, and error visibility.
        </p>
      </div>

      <nav className="space-y-2">
        {ADMIN_SIDEBAR_LINKS.map((item) => {
          const active =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href as Route}
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition ${
                active
                  ? "border-[#14532D] bg-[#0F1D14] text-white"
                  : "border-transparent bg-transparent text-zinc-400 hover:border-[#222222] hover:bg-[#151515] hover:text-white"
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}

export function AdminFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/admin/login";
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  if (isLoginPage) {
    return <div className="min-h-screen bg-[#0A0A0A] text-white">{children}</div>;
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 shrink-0 border-r border-[#1F1F1F] bg-[#111111] px-5 py-6 lg:block">
          <AdminSidebarContent pathname={pathname} />
        </aside>

        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetContent
            side="left"
            className="w-[88vw] max-w-[320px] border-r border-[#1F1F1F] bg-[#111111] p-5 text-white"
          >
            <SheetHeader className="sr-only">
              <SheetTitle>SitePulse Admin Navigation</SheetTitle>
              <SheetDescription>Admin dashboard links and navigation.</SheetDescription>
            </SheetHeader>
            <AdminSidebarContent pathname={pathname} onNavigate={() => setMobileNavOpen(false)} />
          </SheetContent>
        </Sheet>

        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-[#1F1F1F] bg-[#0E0E0E]/95 backdrop-blur">
            <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6">
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="border-[#2A2A2A] bg-[#161616] text-white hover:bg-[#1B1B1B] lg:hidden"
                  onClick={() => setMobileNavOpen(true)}
                >
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Open navigation menu</span>
                </Button>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#22C55E]">
                    Ranula control room
                  </p>
                  <p className="mt-1 text-lg font-semibold text-white">SitePulse Admin</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="hidden rounded-full border border-[#222222] bg-[#131313] px-3 py-1.5 text-xs text-zinc-400 sm:block">
                  Protected by ADMIN_SECRET
                </div>
                <form action="/admin/logout" method="post">
                  <button
                    type="submit"
                    className="rounded-full border border-[#2A2A2A] bg-[#161616] px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-[#22C55E] hover:text-white"
                  >
                    Logout
                  </button>
                </form>
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
