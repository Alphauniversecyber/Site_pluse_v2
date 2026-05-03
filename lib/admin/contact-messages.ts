import "server-only";

import type { ContactMessage, ContactMessageStatus } from "@/types";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export type AdminContactMessageRow = ContactMessage & {
  preview: string;
};

export type AdminContactMessagesData = {
  rows: AdminContactMessageRow[];
  unreadCount: number;
  error: string | null;
};

function buildPreview(message: string) {
  const compact = message.replace(/\s+/g, " ").trim();
  return compact.length > 80 ? `${compact.slice(0, 77)}...` : compact;
}

export async function getAdminContactMessagesData(): Promise<AdminContactMessagesData> {
  const admin = createSupabaseAdminClient();

  const [{ data: rows, error }, { count: unreadCount, error: unreadError }] = await Promise.all([
    admin
      .from("contact_messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200),
    admin
      .from("contact_messages")
      .select("id", { count: "exact", head: true })
      .eq("status", "unread")
  ]);

  if (error || unreadError) {
    return {
      rows: [],
      unreadCount: 0,
      error: error?.message ?? unreadError?.message ?? "Unable to load contact messages."
    };
  }

  return {
    rows: ((rows ?? []) as ContactMessage[]).map((row) => ({
      ...row,
      status: row.status as ContactMessageStatus,
      preview: buildPreview(row.message)
    })),
    unreadCount: unreadCount ?? 0,
    error: null
  };
}

export async function getAdminUnreadContactMessagesCount() {
  const admin = createSupabaseAdminClient();
  const { count, error } = await admin
    .from("contact_messages")
    .select("id", { count: "exact", head: true })
    .eq("status", "unread");

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}
