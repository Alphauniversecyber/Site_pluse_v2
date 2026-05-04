"use client";

import { Bell, CheckCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { EmptyState } from "@/components/dashboard/empty-state";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspace } from "@/hooks/useWorkspace";
import { fetchJson } from "@/lib/api-client";
import { formatRelativeTime } from "@/lib/utils";
import type { NotificationItem } from "@/types";

function formatNotificationTime(value: string) {
  const date = new Date(value);

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function notificationTone(item: NotificationItem) {
  if (item.severity === "high") {
    return { variant: "danger" as const, label: "High priority" };
  }

  if (item.severity === "medium") {
    return { variant: "warning" as const, label: "Medium priority" };
  }

  return { variant: "outline" as const, label: "Low priority" };
}

export default function NotificationsPage() {
  const router = useRouter();
  const workspace = useWorkspace();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const canManageWorkspace = workspace.activeWorkspace.role !== "viewer";

  async function loadNotifications() {
    try {
      setLoading(true);
      const data = await fetchJson<NotificationItem[]>("/api/notifications");
      setNotifications(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load notifications.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadNotifications();
  }, []);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.is_read).length,
    [notifications]
  );

  async function markAllRead() {
    try {
      setMarkingAllRead(true);
      const result = await fetchJson<{ updated: number }>("/api/notifications/mark-all-read", {
        method: "PATCH"
      });
      setNotifications((current) => current.map((item) => ({ ...item, is_read: true })));
      router.refresh();
      toast.success(
        result.updated > 0
          ? `Marked ${result.updated} notification${result.updated === 1 ? "" : "s"} as read.`
          : "Notifications were already up to date."
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to mark notifications as read.");
    } finally {
      setMarkingAllRead(false);
    }
  }

  async function markRead(id: string) {
    try {
      setUpdatingId(id);
      const updated = await fetchJson<NotificationItem>(`/api/notifications/${id}`, {
        method: "PATCH"
      });
      setNotifications((current) =>
        current.map((item) => (item.id === id ? updated : item))
      );
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update notification.");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Notifications"
        title="Every alert in one place"
        description="Track report sends, scan issues, and system updates without losing the thread between quick checks and follow-up work."
        actions={
          canManageWorkspace ? (
            <Button
              onClick={() => {
                void markAllRead();
              }}
              disabled={!unreadCount || markingAllRead}
            >
              <CheckCheck className="h-4 w-4" />
              {markingAllRead ? "Marking..." : "Mark all read"}
            </Button>
          ) : null
        }
      />

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index}>
              <CardContent className="space-y-4 p-5">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : notifications.length ? (
        <div className="space-y-4">
          {notifications.map((item) => {
            const tone = notificationTone(item);

            return (
              <Card key={item.id} className={item.is_read ? "bg-card/72" : undefined}>
                <CardContent className="p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={tone.variant}>{tone.label}</Badge>
                        <Badge variant={item.is_read ? "outline" : "default"}>
                          {item.is_read ? "Read" : "Unread"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatNotificationTime(item.created_at)} {" · "} {formatRelativeTime(item.created_at)}
                        </span>
                      </div>
                      <h2 className="mt-3 text-lg font-semibold">{item.title}</h2>
                      <p className="mt-2 text-sm leading-7 text-muted-foreground">{item.body}</p>
                    </div>

                    {canManageWorkspace ? (
                      <Button
                        variant="outline"
                        disabled={item.is_read || updatingId === item.id}
                        onClick={() => {
                          void markRead(item.id);
                        }}
                      >
                        {updatingId === item.id ? "Updating..." : item.is_read ? "Read" : "Mark read"}
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={Bell}
          title="No notifications yet"
          description="New report deliveries, scan alerts, and monitoring updates will show up here as your workspace gets active."
        />
      )}
    </div>
  );
}
