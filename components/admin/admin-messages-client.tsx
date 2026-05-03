"use client";

import { useEffect, useMemo, useState } from "react";
import { MailOpen, Reply, Send } from "lucide-react";
import { toast } from "sonner";

import { AdminBadge } from "@/components/admin/admin-badge";
import { AdminCard } from "@/components/admin/admin-card";
import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { fetchJson } from "@/lib/api-client";
import type { ContactMessage, ContactMessageStatus } from "@/types";

type MessageRow = ContactMessage & {
  preview: string;
};

type AdminMessagesClientProps = {
  initialRows: MessageRow[];
  initialUnreadCount: number;
};

function statusTone(status: ContactMessageStatus) {
  if (status === "unread") {
    return "red" as const;
  }

  if (status === "replied") {
    return "green" as const;
  }

  return "neutral" as const;
}

function statusLabel(status: ContactMessageStatus) {
  if (status === "unread") return "Unread";
  if (status === "replied") return "Replied";
  return "Read";
}

function formatRelativeTime(value: string) {
  const date = new Date(value);
  const diffMs = date.getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / (1000 * 60));
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  if (Math.abs(diffMinutes) < 60) {
    return formatter.format(diffMinutes, "minute");
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) {
    return formatter.format(diffHours, "hour");
  }

  const diffDays = Math.round(diffHours / 24);
  return formatter.format(diffDays, "day");
}

function dispatchUnreadCount(unreadCount: number) {
  window.dispatchEvent(
    new CustomEvent("admin-contact-unread-count", {
      detail: { unreadCount }
    })
  );
}

export function AdminMessagesClient({
  initialRows,
  initialUnreadCount
}: AdminMessagesClientProps) {
  const [messages, setMessages] = useState(initialRows);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [markingRead, setMarkingRead] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const unreadCount = useMemo(
    () => messages.filter((message) => message.status === "unread").length,
    [messages]
  );
  const selectedMessage = messages.find((message) => message.id === selectedId) ?? null;

  useEffect(() => {
    dispatchUnreadCount(initialUnreadCount);
  }, [initialUnreadCount]);

  async function refreshMessages() {
    setRefreshing(true);
    try {
      const result = await fetchJson<{
        rows: MessageRow[];
        unreadCount: number;
      }>("/api/admin/contact");
      setMessages(result.rows);
      dispatchUnreadCount(result.unreadCount);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to refresh messages.");
    } finally {
      setRefreshing(false);
    }
  }

  async function markAsRead(messageId: string) {
    const target = messages.find((message) => message.id === messageId);
    if (!target || target.status !== "unread") {
      return;
    }

    setMarkingRead(true);
    try {
      const updated = await fetchJson<ContactMessage>(`/api/admin/contact/${messageId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "read" })
      });

      setMessages((current) =>
        current.map((message) =>
          message.id === messageId
            ? {
                ...message,
                ...updated
              }
            : message
        )
      );
      dispatchUnreadCount(Math.max(0, unreadCount - 1));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to mark the message as read.");
    } finally {
      setMarkingRead(false);
    }
  }

  async function openMessage(message: MessageRow) {
    setSelectedId(message.id);
    setReplyDraft(message.admin_reply ?? "");
    setSheetOpen(true);

    if (message.status === "unread") {
      await markAsRead(message.id);
    }
  }

  async function sendReply() {
    if (!selectedMessage) {
      return;
    }

    setSendingReply(true);
    try {
      const updated = await fetchJson<ContactMessage>("/api/admin/contact/reply", {
        method: "POST",
        body: JSON.stringify({
          messageId: selectedMessage.id,
          reply: replyDraft
        })
      });

      setMessages((current) =>
        current.map((message) =>
          message.id === selectedMessage.id
            ? {
                ...message,
                ...updated
              }
            : message
        )
      );
      dispatchUnreadCount(
        messages.filter(
          (message) => message.id !== selectedMessage.id && message.status === "unread"
        ).length
      );
      toast.success("Reply sent.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to send the reply.");
    } finally {
      setSendingReply(false);
    }
  }

  return (
    <div>
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <AdminCard>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Total messages</p>
          <p className="mt-4 text-3xl font-semibold text-white">{messages.length}</p>
        </AdminCard>
        <AdminCard>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Unread</p>
          <p className="mt-4 text-3xl font-semibold text-[#FCA5A5]">{unreadCount}</p>
        </AdminCard>
        <AdminCard>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Inbox state</p>
              <p className="mt-4 text-sm font-medium text-zinc-300">
                {refreshing ? "Refreshing messages..." : "Review, reply, and keep the inbox clear."}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="border-[#2A2A2A] bg-[#161616] text-white hover:bg-[#1B1B1B]"
              onClick={refreshMessages}
              disabled={refreshing}
            >
              Refresh
            </Button>
          </div>
        </AdminCard>
      </div>

      {messages.length ? (
        <AdminCard className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[#0D0D0D] text-zinc-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Sender</th>
                  <th className="px-4 py-3 font-medium">Subject</th>
                  <th className="px-4 py-3 font-medium">Message</th>
                  <th className="px-4 py-3 font-medium">Received</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {messages.map((message, index) => {
                  const unread = message.status === "unread";

                  return (
                    <tr
                      key={message.id}
                      className={`${
                        unread
                          ? "bg-[#17110F]"
                          : index % 2 === 0
                            ? "bg-[#101010]"
                            : "bg-[#141414]"
                      } align-top hover:bg-[#181818]`}
                    >
                      <td className="px-4 py-4">
                        <p className={`break-all ${unread ? "font-semibold text-white" : "font-medium text-white"}`}>
                          {message.name}
                        </p>
                        <p className="mt-1 break-all text-xs text-zinc-500">{message.email}</p>
                      </td>
                      <td className={`px-4 py-4 ${unread ? "font-semibold text-white" : "text-zinc-300"}`}>
                        {message.subject}
                      </td>
                      <td className="px-4 py-4 text-zinc-300">{message.preview}</td>
                      <td className="px-4 py-4 text-zinc-500">{formatRelativeTime(message.created_at)}</td>
                      <td className="px-4 py-4">
                        <AdminBadge label={statusLabel(message.status)} tone={statusTone(message.status)} />
                      </td>
                      <td className="px-4 py-4 text-right">
                        <Button
                          type="button"
                          variant="outline"
                          className="border-[#2A2A2A] bg-[#161616] text-white hover:bg-[#1B1B1B]"
                          onClick={() => void openMessage(message)}
                        >
                          View &amp; Reply
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </AdminCard>
      ) : (
        <AdminEmptyState
          title="No contact messages yet"
          description="New messages from the public contact form will appear here."
        />
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="right"
          className="w-full max-w-2xl border-l border-[#1F1F1F] bg-[#111111] p-6 text-white"
        >
          {selectedMessage ? (
            <>
              <SheetHeader>
                <SheetTitle>{selectedMessage.subject}</SheetTitle>
                <SheetDescription className="text-zinc-400">
                  Message from {selectedMessage.name} at {selectedMessage.email}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 flex-1 overflow-y-auto pr-1">
                <div className="rounded-3xl border border-[#222222] bg-[#0D0D0D] p-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <AdminBadge
                      label={statusLabel(selectedMessage.status)}
                      tone={statusTone(selectedMessage.status)}
                    />
                    <span className="text-xs text-zinc-500">
                      {new Date(selectedMessage.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-3 text-sm text-zinc-300">
                    <p><span className="font-medium text-white">Name:</span> {selectedMessage.name}</p>
                    <p><span className="font-medium text-white">Email:</span> {selectedMessage.email}</p>
                    <p><span className="font-medium text-white">Subject:</span> {selectedMessage.subject}</p>
                  </div>
                  <div className="mt-5 whitespace-pre-wrap rounded-2xl border border-[#222222] bg-[#121212] p-4 text-sm leading-7 text-zinc-300">
                    {selectedMessage.message}
                  </div>
                </div>

                <div className="mt-6">
                  <label htmlFor="admin-contact-reply" className="text-sm font-medium text-white">
                    Your reply
                  </label>
                  <Textarea
                    id="admin-contact-reply"
                    value={replyDraft}
                    onChange={(event) => setReplyDraft(event.target.value)}
                    className="mt-3 min-h-[180px] border-[#2A2A2A] bg-[#0B0B0B] text-white"
                    placeholder="Write your reply..."
                  />
                </div>

                {selectedMessage.admin_reply ? (
                  <div className="mt-6 rounded-3xl border border-[#14532D] bg-[#052E16] p-5">
                    <div className="flex items-center gap-2 text-sm font-medium text-[#86EFAC]">
                      <Reply className="h-4 w-4" />
                      <span>Latest saved reply</span>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#DCFCE7]">
                      {selectedMessage.admin_reply}
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="mt-6 flex flex-wrap justify-end gap-3">
                {selectedMessage.status === "unread" ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="border-[#2A2A2A] bg-[#161616] text-white hover:bg-[#1B1B1B]"
                    onClick={() => void markAsRead(selectedMessage.id)}
                    disabled={markingRead}
                  >
                    <MailOpen className="mr-2 h-4 w-4" />
                    {markingRead ? "Marking..." : "Mark as Read"}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  onClick={() => void sendReply()}
                  disabled={sendingReply}
                >
                  <Send className="mr-2 h-4 w-4" />
                  {sendingReply ? "Sending..." : "Send Reply"}
                </Button>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
