"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, LogOut, Menu, Settings, UserCircle2 } from "lucide-react";

import { SitePulseLogo } from "@/components/brand/sitepulse-logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { fetchJson } from "@/lib/api-client";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { useUser } from "@/hooks/useUser";

export function SiteHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoggingOut, startLogoutTransition] = useTransition();
  const { user, loading } = useUser();

  const isAuthenticated = Boolean(user);
  const firstName = useMemo(() => user?.full_name?.trim().split(/\s+/)[0] ?? null, [user?.full_name]);
  const initials = useMemo(() => {
    if (user?.full_name) {
      return user.full_name
        .split(" ")
        .filter(Boolean)
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();
    }

    return user?.email.slice(0, 2).toUpperCase() ?? "SP";
  }, [user?.email, user?.full_name]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isAuthenticated) {
      setUnreadCount(0);
      return;
    }

    let active = true;

    void fetchJson<{ count: number }>("/api/scans/unread-count")
      .then((result) => {
        if (active) {
          setUnreadCount(result.count);
        }
      })
      .catch(() => {
        if (active) {
          setUnreadCount(0);
        }
      });

    return () => {
      active = false;
    };
  }, [isAuthenticated]);

  const mainLinks = [
    { href: { pathname: "/" }, pathname: "/", label: "Home" },
    { href: { pathname: "/features" }, pathname: "/features", label: "Features" },
    { href: { pathname: "/pricing" }, pathname: "/pricing", label: "Pricing" },
    { href: { pathname: "/about" }, pathname: "/about", label: "About" },
    { href: { pathname: "/blog" }, pathname: "/blog", label: "Blog" }
  ] as const;

  const myReportsHref = { pathname: "/dashboard/reports" } as const;

  function handleLogout() {
    startLogoutTransition(async () => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signOut();

      if (!error) {
        router.push("/");
        router.refresh();
      }
    });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl transition-colors duration-300">
      <div className="container flex h-20 items-center justify-between gap-4">
        <Link href="/" className="inline-flex min-w-0 items-center gap-3">
          <SitePulseLogo variant="light" priority className="h-9 w-[148px] max-w-full dark:hidden sm:w-[164px] md:w-[180px]" />
          <SitePulseLogo variant="dark" priority className="hidden h-9 w-[148px] max-w-full dark:inline-flex sm:w-[164px] md:w-[180px]" />
          <p className="hidden text-xs uppercase tracking-[0.24em] text-muted-foreground lg:block">
            Agency growth system
          </p>
        </Link>
        <nav aria-label="Main navigation" className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          {mainLinks.map((item) => (
            <Link
              key={item.pathname}
              href={item.href}
              className={cn(
                "premium-link",
                pathname === item.pathname ? "text-foreground" : ""
              )}
            >
              <span className="relative inline-flex items-center gap-2">{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-3 md:flex">
          <ThemeToggle />
          {isAuthenticated ? (
            <>
              <Button asChild>
                <Link href="/dashboard">Go to Dashboard</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={myReportsHref}>
                  <span className="relative inline-flex items-center gap-2">
                    My Reports
                    {unreadCount > 0 ? (
                      <span className="relative inline-flex h-2.5 w-2.5">
                        <span className="absolute inset-0 rounded-full bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.45)]" />
                      </span>
                    ) : null}
                  </span>
                </Link>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-2 py-1.5 text-sm shadow-sm transition hover:bg-card"
                    aria-label="Open account menu"
                  >
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={user?.profile_photo_url ?? undefined} alt={user?.full_name ?? user?.email ?? "Profile"} />
                      <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                    <span className="hidden max-w-[7.5rem] truncate text-foreground lg:block">
                      {firstName ?? "Profile"}
                    </span>
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">{user?.full_name ?? "Your account"}</span>
                      <span className="text-xs font-normal text-muted-foreground">{user?.email}</span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard">
                      <UserCircle2 className="h-4 w-4" />
                      Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard/settings">
                      <Settings className="h-4 w-4" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={handleLogout} disabled={isLoggingOut}>
                    <LogOut className="h-4 w-4" />
                    {isLoggingOut ? "Logging out..." : "Logout"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Button asChild variant="outline">
                <Link href="/login">Login</Link>
              </Button>
              <Button asChild>
                <Link href="/#free-scan">Scan a website (free)</Link>
              </Button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />
          {isAuthenticated && !loading ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-full border border-border bg-card/80 p-1.5 shadow-sm"
                  aria-label="Open account menu"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.profile_photo_url ?? undefined} alt={user?.full_name ?? user?.email ?? "Profile"} />
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem asChild>
                  <Link href="/dashboard">
                    <UserCircle2 className="h-4 w-4" />
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/settings">
                    <Settings className="h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={handleLogout} disabled={isLoggingOut}>
                  <LogOut className="h-4 w-4" />
                  {isLoggingOut ? "Logging out..." : "Logout"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
          <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="md:hidden">
              <Menu className="h-4 w-4" />
              <span className="sr-only">Open navigation menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[calc(100vw-1rem)] max-w-sm">
            <SheetHeader className="pr-10">
              <Link href="/" className="inline-flex max-w-full items-center">
                <SitePulseLogo variant="light" className="h-10 w-[170px] max-w-full dark:hidden" />
                <SitePulseLogo variant="dark" className="hidden h-10 w-[170px] max-w-full dark:inline-flex" />
              </Link>
              <SheetTitle className="pt-4">Navigate SitePulse</SheetTitle>
              <SheetDescription>
                Explore the agency-growth workflow, pricing, and sign in from any screen size.
              </SheetDescription>
            </SheetHeader>

            <nav aria-label="Mobile navigation" className="mt-8 space-y-2">
              {mainLinks.map((item) => (
                <Link
                  key={item.pathname}
                  href={item.href}
                  className={cn(
                    "flex items-center rounded-2xl px-4 py-3 text-sm transition duration-200",
                    pathname === item.pathname
                      ? "bg-card text-foreground"
                      : "text-muted-foreground hover:bg-card hover:text-foreground"
                  )}
                >
                  <span className="relative inline-flex items-center gap-2">{item.label}</span>
                </Link>
              ))}
            </nav>

            <div className="mt-8">
              <Button asChild className="w-full">
                <Link href={isAuthenticated ? "/dashboard" : "/#free-scan"}>
                  {isAuthenticated ? "Go to Dashboard" : "Scan a website (free)"}
                </Link>
              </Button>
              {isAuthenticated ? (
                <Button asChild variant="outline" className="mt-3 w-full">
                  <Link href={myReportsHref}>
                    <span className="relative inline-flex items-center gap-2">
                      Open My Reports
                      {unreadCount > 0 ? (
                        <span className="relative inline-flex h-2.5 w-2.5">
                          <span className="absolute inset-0 rounded-full bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.45)]" />
                        </span>
                      ) : null}
                    </span>
                  </Link>
                </Button>
              ) : (
                <Button asChild variant="outline" className="mt-3 w-full">
                  <Link href="/login">Login</Link>
                </Button>
              )}
            </div>
          </SheetContent>
        </Sheet>
        </div>
      </div>
    </header>
  );
}
