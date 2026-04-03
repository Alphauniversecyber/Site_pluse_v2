import "server-only";

import { type DetailedPeerCertificate, TLSSocket, connect as tlsConnect } from "node:tls";

import type { SslCheckRecord } from "@/types";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const SSL_CACHE_HOURS = 24;

function isFresh(timestamp: string, hours: number) {
  return Date.now() - new Date(timestamp).getTime() < hours * 60 * 60 * 1000;
}

function normalizeIssuer(cert: DetailedPeerCertificate) {
  const issuer = cert.issuer as Record<string, string> | undefined;
  if (!issuer) {
    return null;
  }

  return issuer.O || issuer.CN || Object.values(issuer).filter(Boolean).join(", ") || null;
}

function gradeSslCheck(isValid: boolean, daysUntilExpiry: number | null): SslCheckRecord["grade"] {
  if (!isValid || daysUntilExpiry === null || daysUntilExpiry < 0) {
    return "critical";
  }

  if (daysUntilExpiry <= 6) {
    return "red";
  }

  if (daysUntilExpiry <= 29) {
    return "orange";
  }

  return "green";
}

function readCertificate(hostname: string) {
  return new Promise<{
    isValid: boolean;
    expiryDate: string | null;
    daysUntilExpiry: number | null;
    issuer: string | null;
    errorMessage: string | null;
  }>((resolve, reject) => {
    const socket = tlsConnect({
      host: hostname,
      port: 443,
      servername: hostname,
      rejectUnauthorized: false,
      timeout: 15000
    });

    const finalize = (
      payload: Parameters<typeof resolve>[0]
    ) => {
      if (!socket.destroyed) {
        socket.destroy();
      }
      resolve(payload);
    };

    socket.once("secureConnect", () => {
      const tlsSocket = socket as TLSSocket;
      const certificate = tlsSocket.getPeerCertificate(true) as DetailedPeerCertificate;

      if (!certificate || Object.keys(certificate).length === 0) {
        finalize({
          isValid: false,
          expiryDate: null,
          daysUntilExpiry: null,
          issuer: null,
          errorMessage: "No certificate was returned by the server."
        });
        return;
      }

      const validToRaw = typeof certificate.valid_to === "string" ? certificate.valid_to : null;
      const expiry = validToRaw ? new Date(validToRaw) : null;
      const daysUntilExpiry =
        expiry && !Number.isNaN(expiry.getTime())
          ? Math.floor((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          : null;

      finalize({
        isValid: Boolean(tlsSocket.authorized) && (daysUntilExpiry === null || daysUntilExpiry >= 0),
        expiryDate: expiry && !Number.isNaN(expiry.getTime()) ? expiry.toISOString() : null,
        daysUntilExpiry,
        issuer: normalizeIssuer(certificate),
        errorMessage:
          typeof tlsSocket.authorizationError === "string"
            ? tlsSocket.authorizationError
            : tlsSocket.authorizationError instanceof Error
              ? tlsSocket.authorizationError.message
              : null
      });
    });

    socket.once("timeout", () => {
      socket.destroy();
      reject(new Error("SSL check timed out."));
    });

    socket.once("error", (error) => {
      socket.destroy();
      reject(error);
    });
  });
}

export function getSslAlertThreshold(check: SslCheckRecord) {
  if (check.days_until_expiry === null) {
    return null;
  }

  if (check.days_until_expiry < 0 || check.grade === "critical") {
    return "expired" as const;
  }

  if (check.days_until_expiry <= 7) {
    return "7_days" as const;
  }

  if (check.days_until_expiry <= 30) {
    return "30_days" as const;
  }

  return null;
}

export async function ensureSslCheck(input: {
  websiteId: string;
  url: string;
  force?: boolean;
}) {
  const admin = createSupabaseAdminClient();
  const { data: latest } = await admin
    .from("ssl_checks")
    .select("*")
    .eq("website_id", input.websiteId)
    .order("checked_at", { ascending: false })
    .limit(1)
    .maybeSingle<SslCheckRecord>();

  if (!input.force && latest?.checked_at && isFresh(latest.checked_at, SSL_CACHE_HOURS)) {
    return latest;
  }

  const parsedUrl = new URL(input.url);

  if (parsedUrl.protocol !== "https:") {
    const insecureRecord = {
      website_id: input.websiteId,
      is_valid: false,
      expiry_date: null,
      days_until_expiry: null,
      issuer: null,
      grade: "critical" as const,
      checked_at: new Date().toISOString()
    };

    const { data, error } = await admin.from("ssl_checks").insert(insecureRecord).select("*").single();

    if (error || !data) {
      throw new Error(error?.message ?? "Unable to store SSL check.");
    }

    return data as SslCheckRecord;
  }

  const certificate = await readCertificate(parsedUrl.hostname);
  const record = {
    website_id: input.websiteId,
    is_valid: certificate.isValid,
    expiry_date: certificate.expiryDate,
    days_until_expiry: certificate.daysUntilExpiry,
    issuer: certificate.issuer,
    grade: gradeSslCheck(certificate.isValid, certificate.daysUntilExpiry),
    checked_at: new Date().toISOString()
  };

  const { data, error } = await admin.from("ssl_checks").insert(record).select("*").single();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to store SSL check.");
  }

  return data as SslCheckRecord;
}
