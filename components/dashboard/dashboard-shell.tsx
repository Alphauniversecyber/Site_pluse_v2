"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { CreditCard, FileText, Gauge, Globe2, Menu, Palette, Settings } from "lucide-react";

import { SitePulseLogo } from "@/components/brand/sitepulse-logo";
import { LogoutButton } from "@/components/dashboard/logout-button";
import { NotificationBell } from "@/components/dashboard/notification-bell";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { NotificationItem, UserProfile } from "@/types";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/dashboard", label: "Overview", icon: Gauge },
  { href: "/dashboard/websites", label: "Websites", icon: Globe2 },
  { href: "/dashboard/reports", label: "Reports", icon: FileText },
  { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
  { href: "/dashboard/branding", label: "Branding", icon: Palette },
  { href: "/dashboard/settings", label: "Settings", icon: Settings }
] as const;

export function DashboardShell({
  children,
  profile,
  notifications
}: {
  children: React.ReactNode;
  profile: UserProfile;
  notifications: NotificationItem[];
}) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const initials =
    profile.full_name
      ?.split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || profile.email.slice(0, 2).toUpperCase();

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  const isActive = (href: string) =>
    pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));

  const navItems = (
    <nav className="mt-8 space-y-2.5">
      {navigation.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3.5 rounded-2xl px-4 py-3.5 text-sm font-medium transition duration-200",
              active
                ? "bg-card text-foreground shadow-[inset_0_0_0_1px_rgba(59,130,246,0.2),0_18px_44px_-30px_rgba(15,23,42,0.35)]"
                : "text-muted-foreground hover:bg-card/90 hover:text-foreground"
            )}
          >
            <Icon className={cn("h-5 w-5 shrink-0", active ? "text-primary" : "")} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      <div className="mx-auto flex min-h-screen w-full max-w-[1780px]">
        <aside className="hidden border-r border-border/80 bg-card/65 backdrop-blur lg:block lg:w-[292px] xl:w-[316px] 2xl:w-[336px]">
          <div className="sticky top-0 flex h-screen flex-col px-7 py-8 xl:px-8 xl:py-9 2xl:px-10">
            <div className="border-b border-border/70 pb-8">
              <Link href="/" className="inline-flex max-w-full flex-col items-start gap-2.5">
                <SitePulseLogo variant="light" className="h-10 w-[176px] max-w-full dark:hidden" />
                <SitePulseLogo variant="dark" className="hidden h-10 w-[176px] max-w-full dark:inline-flex" />
                <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Built for agencies</p>
              </Link>
            </div>

            <div className="theme-panel mt-8 rounded-[1.75rem] p-5">
              <div className="flex items-center gap-3.5">
                <Avatar className="h-11 w-11">
                  <AvatarImage src={profile.profile_photo_url ?? undefined} alt={profile.full_name ?? profile.email} />
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate font-medium">{profile.full_name || profile.email}</p>
                  <p className="truncate text-sm text-muted-foreground">{profile.email}</p>
                </div>
              </div>
              <Badge className="mt-4" variant={profile.plan === "agency" ? "success" : profile.plan === "starter" ? "default" : "outline"}>
                {profile.plan} plan
              </Badge>
            </div>

            <div className="mt-8 flex-1">
              <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                Workspace
              </p>
              {navItems}
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 border-b border-border/80 bg-background/80 backdrop-blur-xl transition-colors duration-300">
            <div className="mx-auto flex w-full max-w-[1360px] items-center justify-between gap-4 px-4 py-4 md:px-6 lg:px-8 xl:px-10 2xl:px-12">
              <div className="flex min-w-0 items-center gap-3">
                <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="icon" className="lg:hidden">
                      <Menu className="h-4 w-4" />
                      <span className="sr-only">Open dashboard menu</span>
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-[calc(100vw-1rem)] max-w-sm overflow-y-auto">
                    <SheetHeader className="pr-10">
                      <Link href="/" className="inline-flex max-w-full flex-col items-start gap-3">
                        <SitePulseLogo variant="light" className="h-10 w-[170px] max-w-full dark:hidden" />
                        <SitePulseLogo variant="dark" className="hidden h-10 w-[170px] max-w-full dark:inline-flex" />
                        <span className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                          Built for agencies
                        </span>
                      </Link>
                      <SheetTitle className="pt-4">Dashboard navigation</SheetTitle>
                      <SheetDescription>
                        Jump between websites, reports, branding, billing, and settings on smaller screens.
                      </SheetDescription>
                    </SheetHeader>

                    <div className="theme-panel mt-6 rounded-3xl p-4">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={profile.profile_photo_url ?? undefined} alt={profile.full_name ?? profile.email} />
                          <AvatarFallback>{initials}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{profile.full_name || profile.email}</p>
                          <p className="truncate text-sm text-muted-foreground">{profile.email}</p>
                        </div>
                      </div>
                      <Badge
                        className="mt-4"
                        variant={profile.plan === "agency" ? "success" : profile.plan === "starter" ? "default" : "outline"}
                      >
                        {profile.plan} plan
                      </Badge>
                    </div>

                    {navItems}

                    <div className="mt-8 border-t border-border pt-6">
                      <LogoutButton />
                    </div>
                  </SheetContent>
                </Sheet>

                <Link href="/" className="inline-flex max-w-full items-center lg:hidden">
                  <SitePulseLogo variant="light" className="h-9 w-[144px] max-w-full dark:hidden" />
                  <SitePulseLogo variant="dark" className="hidden h-9 w-[144px] max-w-full dark:inline-flex" />
                </Link>

                <div className="hidden min-w-0 lg:block">
                  <p className="text-xs uppercase tracking-[0.24em] text-primary">Agency monitoring</p>
                  <p className="text-sm text-muted-foreground">Know when client sites break before they call.</p>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                <ThemeToggle />
                <NotificationBell notifications={notifications} />
                <div className="hidden sm:block">
                  <LogoutButton />
                </div>
              </div>
            </div>
          </header>
          <div className="page-shell mx-auto w-full max-w-[1360px] px-4 py-6 md:px-6 md:py-8 lg:px-8 xl:px-10 xl:py-10 2xl:px-12">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
