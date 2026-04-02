"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";

import { SitePulseLogo } from "@/components/brand/sitepulse-logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const links = [
    { href: "/features", label: "Features" },
    { href: "/pricing", label: "Pricing" },
    { href: "/login", label: "Login" }
  ] as const;

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl transition-colors duration-300">
      <div className="container flex h-20 items-center justify-between gap-4">
        <Link href="/" className="inline-flex min-w-0 items-center gap-3">
          <SitePulseLogo variant="light" priority className="h-9 w-[148px] max-w-full dark:hidden sm:w-[164px] md:w-[180px]" />
          <SitePulseLogo variant="dark" priority className="hidden h-9 w-[148px] max-w-full dark:inline-flex sm:w-[164px] md:w-[180px]" />
          <p className="hidden text-xs uppercase tracking-[0.24em] text-muted-foreground lg:block">
            Built for agencies
          </p>
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          {links.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "premium-link",
                pathname === item.href ? "text-foreground" : ""
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-3 md:flex">
          <ThemeToggle />
          <Button asChild>
            <Link href="/signup">Start Free</Link>
          </Button>
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />
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
                Explore features, pricing, and sign in from any screen size without losing access to the main nav.
              </SheetDescription>
            </SheetHeader>

            <nav className="mt-8 space-y-2">
              {links.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center rounded-2xl px-4 py-3 text-sm transition duration-200",
                    pathname === item.href
                      ? "bg-card text-foreground"
                      : "text-muted-foreground hover:bg-card hover:text-foreground"
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="mt-8">
              <Button asChild className="w-full">
                <Link href="/signup">Start Free</Link>
              </Button>
            </div>
          </SheetContent>
        </Sheet>
        </div>
      </div>
    </header>
  );
}
