"use client";

import { Bell } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/hooks/useWorkspace";
import type { NotificationItem } from "@/types";
import { cn, formatRelativeTime } from "@/lib/utils";
import { fetchJson } from "@/lib/api-client";

type NotificationFilter = "all" | "high" | "system";

const FILTER_TABS: Array<{ key: NotificationFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "high", label: "High" },
  { key: "system", label: "System" }
];

const SYSTEM_NOTIFICATION_TYPES = new Set<NotificationItem["type"]>([
  "report_ready",
  "uptime_alert",
  "competitor_alert",
  "broken_links_alert",
  "scan_failure",
  "ssl_expiry"
]);

const clampTwoLinesStyle = {
  display: "-webkit-box",
  overflow: "hidden",
  WebkitBoxOrient: "vertical" as const,
  WebkitLineClamp: 2
};

function isToday(value: string) {
  const date = new Date(value);
  const today = new Date();

  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

function isSystemNotification(item: NotificationItem) {
  return SYSTEM_NOTIFICATION_TYPES.has(item.type);
}

function formatPanelTimestamp(value: string) {
  const date = new Date(value);
  const ageMs = Date.now() - date.getTime();

  if (ageMs < 24 * 60 * 60 * 1000) {
    return formatRelativeTime(date);
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function formatWebsiteTag(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      return new URL(trimmed).hostname.replace(/^www\./i, "");
    } catch {
      return trimmed;
    }
  }

  return trimmed;
}

function getWebsiteTag(item: NotificationItem) {
  const metadata = item.metadata ?? {};
  const candidates = [
    metadata.websiteLabel,
    metadata.websiteName,
    metadata.websiteUrl,
    metadata.url,
    metadata.competitorUrl
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string") {
      const tag = formatWebsiteTag(candidate);

      if (tag) {
        return tag;
      }
    }
  }

  return null;
}

function getNotificationTone(item: NotificationItem) {
  if (isSystemNotification(item) && item.severity === "low") {
    return {
      badgeLabel: "System",
      badgeClassName: "border-[#22C55E]/20 bg-[#11281A] text-[#22C55E]",
      borderColor: "#22C55E"
    };
  }

  if (item.severity === "high") {
    return {
      badgeLabel: "High",
      badgeClassName: "border-[#EF4444]/20 bg-[#2D1B1B] text-[#EF4444]",
      borderColor: "#EF4444"
    };
  }

  if (item.severity === "medium") {
    return {
      badgeLabel: "Medium",
      badgeClassName: "border-[#F59E0B]/20 bg-[#2D240F] text-[#F59E0B]",
      borderColor: "#F59E0B"
    };
  }

  return {
    badgeLabel: "Low",
    badgeClassName: "border-[#3B82F6]/20 bg-[#0F1E35] text-[#3B82F6]",
    borderColor: "#3B82F6"
  };
}

export function NotificationBell({ notifications }: { notifications: NotificationItem[] }) {
  const pathname = usePathname();
  const workspace = useWorkspace();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(notifications);
  const [activeFilter, setActiveFilter] = useState<NotificationFilter>("all");
  const [isPending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    setItems(notifications);
  }, [notifications]);

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

  function clearNotifications() {
    startTransition(async () => {
      try {
        const result = await fetchJson<{ cleared: number }>("/api/notifications", {
          method: "DELETE"
        });

        setItems([]);
        toast.success(
          result.cleared > 0
            ? `Cleared ${result.cleared} notification${result.cleared === 1 ? "" : "s"}.`
            : "Notifications already clear."
        );
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to clear notifications.");
      }
    });
  }

  const unreadCount = items.filter((item) => !item.is_read).length;
  const canManageWorkspace = workspace.activeWorkspace.role !== "viewer";
  const filteredItems = items.filter((item) => {
    if (activeFilter === "high") {
      return item.severity === "high";
    }

    if (activeFilter === "system") {
      return isSystemNotification(item);
    }

    return true;
  });
  const todayItems = filteredItems.filter((item) => isToday(item.created_at));
  const earlierItems = filteredItems.filter((item) => !isToday(item.created_at));
  const tabCounts = {
    all: items.length,
    high: items.filter((item) => item.severity === "high").length,
    system: items.filter((item) => isSystemNotification(item)).length
  };

  return (
    <>
      <div ref={containerRef} className="relative">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          "header-action-button relative h-10 w-10 rounded-full text-slate-400 transition duration-150 motion-safe:hover:scale-100 motion-safe:active:scale-100",
          open
            ? "bg-[#1E3A5F] text-[#3B82F6] shadow-[inset_0_0_0_1px_rgba(125,211,252,0.08)]"
            : "hover:bg-[#152238] hover:text-slate-100"
        )}
        data-state={open ? "active" : "inactive"}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Open notifications"
        onClick={() => setOpen((current) => !current)}
      >
        <Bell className="h-[18px] w-[18px]" strokeWidth={1.9} />
        {unreadCount ? (
          <span className="absolute -right-1 -top-1 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#EF4444] px-1 text-[10px] font-bold leading-none text-white shadow-[0_0_0_3px_rgba(15,26,46,0.85)] animate-[notification-bell-pulse_2s_ease-in-out_infinite]">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </Button>

      <div
        className={cn(
          "absolute right-0 top-[calc(100%+0.75rem)] z-[9999] w-[420px] max-w-[calc(100vw-1.5rem)] origin-top-right overflow-hidden rounded-2xl border border-[#1E3A5F] bg-[#0F1A2E] shadow-[0_24px_48px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.05)] transition duration-200 ease-out",
          open
            ? "pointer-events-auto translate-y-0 opacity-100 animate-[notification-panel-in_0.2s_ease-out]"
            : "pointer-events-none -translate-y-2 opacity-0"
        )}
      >
        <div className="border-b border-[#1E3A5F] bg-[#0D1525] px-5 pb-4 pt-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-base font-semibold text-slate-100">Notifications</p>
              <p className="mt-1 text-xs text-[#64748B]">
                {unreadCount} unread
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                disabled
                className="rounded-md border border-[#1E3A5F] px-2.5 py-1 text-[12px] font-medium text-[#64748B] transition hover:border-[#3B82F6] hover:text-[#3B82F6] disabled:cursor-default disabled:opacity-100"
              >
                Mark all read
              </button>
              <button
                type="button"
                className="rounded-md border border-[#1E3A5F] px-2.5 py-1 text-[12px] font-medium text-[#64748B] transition hover:border-[#EF4444] hover:text-[#EF4444] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-[#1E3A5F] disabled:hover:text-[#64748B]"
                onClick={clearNotifications}
                disabled={!items.length || isPending || !canManageWorkspace}
              >
                {isPending ? "Clearing..." : "Clear all"}
              </button>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            {FILTER_TABS.map((tab) => {
              const active = activeFilter === tab.key;

              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveFilter(tab.key)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[0.08em] transition",
                    active
                      ? "border-[#1E3A5F] bg-[#1E3A5F] text-slate-100"
                      : "border-transparent bg-transparent text-[#64748B] hover:border-[#1E3A5F] hover:text-slate-100"
                  )}
                >
                  {tab.label} <span className="ml-1 text-[11px] opacity-80">{tabCounts[tab.key]}</span>
                </button>
              );
            })}
          </div>
        </div>

        {filteredItems.length ? (
          <div className="notification-panel-scroll max-h-[420px] overflow-y-auto py-2">
            {todayItems.length ? (
              <div>
                <p className="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#334155]">
                  Today
                </p>
                {todayItems.map((item) => {
                  const tone = getNotificationTone(item);
                  const websiteTag = getWebsiteTag(item);

                  return (
                    <div
                      key={item.id}
                      className="group relative mx-3 my-2 cursor-pointer rounded-xl border border-[#1A2B45] border-l-4 bg-[#111E33] px-4 py-3.5 transition duration-150 hover:bg-[#152238] animate-[notification-item-in_0.3s_ease-out]"
                      style={{ borderLeftColor: tone.borderColor }}
                    >
                      {!item.is_read ? (
                        <span className="absolute right-4 top-4 h-1.5 w-1.5 rounded-full bg-[#3B82F6] transition duration-150 group-hover:opacity-0" />
                      ) : null}

                      <div className="flex items-start justify-between gap-3 pr-4">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em]",
                            tone.badgeClassName
                          )}
                        >
                          {tone.badgeLabel}
                        </span>
                        <span className="shrink-0 text-[11px] text-[#475569]">
                          {formatPanelTimestamp(item.created_at)}
                        </span>
                      </div>

                      <p className="mt-2 text-[14px] font-semibold leading-[1.4] text-slate-100" style={clampTwoLinesStyle}>
                        {item.title}
                      </p>
                      <p className="mt-1 text-[13px] leading-[1.5] text-slate-400" style={clampTwoLinesStyle}>
                        {item.body}
                      </p>

                      {websiteTag ? (
                        <span className="mt-3 inline-flex rounded-md bg-[#1E3A5F] px-2 py-0.5 text-[11px] font-medium text-[#7DD3FC]">
                          {websiteTag}
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}

            {earlierItems.length ? (
              <div>
                <p className="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#334155]">
                  Earlier
                </p>
                {earlierItems.map((item) => {
                  const tone = getNotificationTone(item);
                  const websiteTag = getWebsiteTag(item);

                  return (
                    <div
                      key={item.id}
                      className="group relative mx-3 my-2 cursor-pointer rounded-xl border border-[#1A2B45] border-l-4 bg-[#111E33] px-4 py-3.5 transition duration-150 hover:bg-[#152238] animate-[notification-item-in_0.3s_ease-out]"
                      style={{ borderLeftColor: tone.borderColor }}
                    >
                      {!item.is_read ? (
                        <span className="absolute right-4 top-4 h-1.5 w-1.5 rounded-full bg-[#3B82F6] transition duration-150 group-hover:opacity-0" />
                      ) : null}

                      <div className="flex items-start justify-between gap-3 pr-4">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em]",
                            tone.badgeClassName
                          )}
                        >
                          {tone.badgeLabel}
                        </span>
                        <span className="shrink-0 text-[11px] text-[#475569]">
                          {formatPanelTimestamp(item.created_at)}
                        </span>
                      </div>

                      <p className="mt-2 text-[14px] font-semibold leading-[1.4] text-slate-100" style={clampTwoLinesStyle}>
                        {item.title}
                      </p>
                      <p className="mt-1 text-[13px] leading-[1.5] text-slate-400" style={clampTwoLinesStyle}>
                        {item.body}
                      </p>

                      {websiteTag ? (
                        <span className="mt-3 inline-flex rounded-md bg-[#1E3A5F] px-2 py-0.5 text-[11px] font-medium text-[#7DD3FC]">
                          {websiteTag}
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex min-h-[320px] flex-col items-center justify-center px-5 py-10 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[#1E3A5F] bg-[#111E33] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <Bell className="h-7 w-7 text-[#7DD3FC]" strokeWidth={1.8} />
            </div>
            <p className="mt-4 text-base font-semibold text-slate-100">All caught up!</p>
            <p className="mt-2 text-[13px] text-[#64748B]">No new notifications right now.</p>
          </div>
        )}

        <div className="border-t border-[#1E3A5F] bg-[#0D1525] px-5 py-3 text-center">
          <button
            type="button"
            className="text-[13px] font-medium text-[#3B82F6] transition hover:text-[#60A5FA]"
          >
            View all notifications &rarr;
          </button>
        </div>
      </div>
      </div>

      <style jsx global>{`
        @keyframes notification-bell-pulse {
          0% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.2);
          }
          100% {
            transform: scale(1);
          }
        }

        @keyframes notification-panel-in {
          0% {
            opacity: 0;
            transform: translateY(-8px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes notification-item-in {
          0% {
            opacity: 0;
            transform: translateX(20px);
          }
          100% {
            opacity: 1;
            transform: translateX(0);
          }
        }

        .notification-panel-scroll::-webkit-scrollbar {
          width: 4px;
        }

        .notification-panel-scroll::-webkit-scrollbar-track {
          background: transparent;
        }

        .notification-panel-scroll::-webkit-scrollbar-thumb {
          border-radius: 999px;
          background: #1e3a5f;
        }

        .notification-panel-scroll::-webkit-scrollbar-thumb:hover {
          background: #3b82f6;
        }
      `}</style>
    </>
  );
}
