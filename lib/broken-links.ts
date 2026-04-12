import "server-only";
import type { BrokenLinkRecord } from "@/types";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export async function ensureBrokenLinkCheck(input: {
  websiteId: string;
  url: string;
  scanId?: string | null;
  force?: boolean;
}) {
  const admin = createSupabaseAdminClient();

  const { data: latest } = await admin
    .from("broken_links")
    .select("*")
    .eq("website_id", input.websiteId)
    .order("scanned_at", { ascending: false })
    .limit(1)
    .maybeSingle<BrokenLinkRecord>();

  if (!input.force && latest?.scanned_at) {
    return latest;
  }

  const payload = {
    website_id: input.websiteId,
    scan_id: input.scanId ?? null,
    total_links: 0,
    working_links: 0,
    broken_links: 0,
    redirect_chains: 0,
    broken_urls: [],
    redirect_urls: [],
    scanned_at: new Date().toISOString()
  };

  const { data, error } = await admin
    .from("broken_links")
    .insert(payload)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to store broken link results.");
  }

  return data as BrokenLinkRecord;
}