import "server-only";

import type { SecurityHeadersRecord } from "@/types";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const SECURITY_HEADERS_CACHE_HOURS = 24;

function isFresh(timestamp: string, hours: number) {
  return Date.now() - new Date(timestamp).getTime() < hours * 60 * 60 * 1000;
}

function gradeHeaderScore(count: number): SecurityHeadersRecord["grade"] {
  if (count >= 6) {
    return "A";
  }

  if (count >= 4) {
    return "B";
  }

  if (count >= 2) {
    return "C";
  }

  return "F";
}

async function fetchHeaders(url: string) {
  const baseInit = {
    cache: "no-store" as const,
    redirect: "follow" as const,
    signal: AbortSignal.timeout(20000),
    headers: {
      "user-agent": "SitePulse Security Audit/1.0"
    }
  };

  const headResponse = await fetch(url, {
    ...baseInit,
    method: "HEAD"
  }).catch(() => null);

  if (headResponse?.ok || headResponse?.headers) {
    return headResponse.headers;
  }

  const getResponse = await fetch(url, {
    ...baseInit,
    method: "GET"
  });

  return getResponse.headers;
}

export async function ensureSecurityHeadersCheck(input: {
  websiteId: string;
  url: string;
  force?: boolean;
}) {
  const admin = createSupabaseAdminClient();
  const { data: latest } = await admin
    .from("security_headers")
    .select("*")
    .eq("website_id", input.websiteId)
    .order("checked_at", { ascending: false })
    .limit(1)
    .maybeSingle<SecurityHeadersRecord>();

  if (!input.force && latest?.checked_at && isFresh(latest.checked_at, SECURITY_HEADERS_CACHE_HOURS)) {
    return latest;
  }

  const headers = await fetchHeaders(input.url);
  const hstsValue = headers.get("strict-transport-security");
  const cspValue = headers.get("content-security-policy");
  const xFrameOptionsValue = headers.get("x-frame-options");
  const xContentTypeValue = headers.get("x-content-type-options");
  const referrerPolicyValue = headers.get("referrer-policy");
  const permissionsPolicyValue = headers.get("permissions-policy");

  const presentCount = [
    Boolean(hstsValue),
    Boolean(cspValue),
    Boolean(xFrameOptionsValue),
    Boolean(xContentTypeValue),
    Boolean(referrerPolicyValue),
    Boolean(permissionsPolicyValue)
  ].filter(Boolean).length;

  const payload = {
    website_id: input.websiteId,
    hsts: Boolean(hstsValue),
    hsts_value: hstsValue,
    csp: Boolean(cspValue),
    csp_value: cspValue,
    x_frame_options: Boolean(xFrameOptionsValue),
    x_frame_options_value: xFrameOptionsValue,
    x_content_type: Boolean(xContentTypeValue),
    x_content_type_value: xContentTypeValue,
    referrer_policy: Boolean(referrerPolicyValue),
    referrer_policy_value: referrerPolicyValue,
    permissions_policy: Boolean(permissionsPolicyValue),
    permissions_policy_value: permissionsPolicyValue,
    grade: gradeHeaderScore(presentCount),
    checked_at: new Date().toISOString()
  };

  const { data, error } = await admin.from("security_headers").insert(payload).select("*").single();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to store security headers audit.");
  }

  return data as SecurityHeadersRecord;
}
