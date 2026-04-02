"use client";

import { Bell, BellRing, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { NotificationItem } from "@/types";
import { cn, formatRelativeTime } from "@/lib/utils";

const severityVariant: Record<NotificationItem["severity"], "outline" | "warning" | "danger"> = {
  low: "outline",
  medium: "warning",
  high: "danger"
};

export function NotificationBell({ notifications }: { notifications: NotificationItem[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={cn(
          "relative border-border/80 bg-background/80 backdrop-blur",
          open && "border-primary/40 bg-primary/5 text-primary"
        )}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Open notifications"
        onClick={() => setOpen((current) => !current)}
      >
        <Bell className="h-4 w-4" />
        {notifications.length ? (
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-500" />
        ) : null}
      </Button>

      <div
        className={cn(
          "absolute right-0 top-[calc(100%+0.75rem)] z-50 w-[min(24rem,calc(100vw-2rem))] origin-top-right rounded-[1.75rem] border border-border bg-card/98 p-4 shadow-[0_32px_90px_-44px_rgba(15,23,42,0.65)] backdrop-blur-xl transition duration-200 ease-out",
          open
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-2 opacity-0"
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-display text-lg font-semibold">Notifications</p>
            <p className="text-sm text-muted-foreground">Stay ahead of score drops and scan failures.</p>
          </div>
          <Badge variant="outline">{notifications.length}</Badge>
        </div>

        {notifications.length ? (
          <div className="mt-4 space-y-3">
            {notifications.slice(0, 6).map((item) => (
              <div
                key={item.id}
                className="rounded-[1.35rem] border border-border bg-background/90 p-4 transition duration-200 hover:border-primary/25 hover:bg-background"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{item.title}</p>
                      <Badge variant={severityVariant[item.severity]}>{item.severity}</Badge>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.body}</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatRelativeTime(item.created_at)}</span>
                </div>
              </div>
            ))}

            <button
              type="button"
              className="premium-link inline-flex items-center gap-2 text-sm font-medium text-primary"
            >
              Notification history coming soon
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="mt-4 rounded-[1.5rem] border border-dashed border-border bg-background/80 px-5 py-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <BellRing className="h-5 w-5" />
            </div>
            <p className="mt-4 font-medium">No notifications yet</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Alerts about failed scans, score drops, and report activity will appear here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
