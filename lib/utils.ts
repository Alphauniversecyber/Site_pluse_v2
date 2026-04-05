import { type ClassValue, clsx } from "clsx";
import { formatDistanceToNowStrict } from "date-fns";
import { twMerge } from "tailwind-merge";

import type { PlanKey } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const PLAN_LIMITS: Record<
  PlanKey,
  {
    name: string;
    price: number;
    websiteLimit: number;
    scanFrequencies: Array<"daily" | "weekly" | "monthly">;
    historyDays: number;
    emailReports: boolean;
    pdfReports: boolean;
    teamMembers: number;
    whiteLabel: boolean;
    csvExport: boolean;
  }
> = {
  free: {
    name: "Starter",
    price: 0,
    websiteLimit: 1,
    scanFrequencies: ["weekly"],
    historyDays: 30,
    emailReports: false,
    pdfReports: false,
    teamMembers: 1,
    whiteLabel: false,
    csvExport: false
  },
  starter: {
    name: "Growth",
    price: 49,
    websiteLimit: 5,
    scanFrequencies: ["daily", "weekly", "monthly"],
    historyDays: 90,
    emailReports: true,
    pdfReports: true,
    teamMembers: 1,
    whiteLabel: false,
    csvExport: false
  },
  agency: {
    name: "Pro",
    price: 149,
    websiteLimit: 30,
    scanFrequencies: ["daily", "weekly", "monthly"],
    historyDays: 365,
    emailReports: true,
    pdfReports: true,
    teamMembers: 3,
    whiteLabel: true,
    csvExport: true
  }
};

export const PLAN_MARKETING: Record<
  PlanKey,
  {
    displayName: string;
    audience: string;
    roiLine: string;
  }
> = {
  free: {
    displayName: "Starter",
    audience: "For freelancers testing value",
    roiLine: "Prove value on one client site before you scale."
  },
  starter: {
    displayName: "Growth",
    audience: "For agencies managing multiple clients",
    roiLine: "Close one extra client and this plan pays for itself."
  },
  agency: {
    displayName: "Pro",
    audience: "For serious agencies scaling operations",
    roiLine: "Turn monitoring into a premium retained service."
  }
};

export function getPlanDisplayName(plan: PlanKey) {
  return PLAN_MARKETING[plan].displayName;
}

export function getPlanAudience(plan: PlanKey) {
  return PLAN_MARKETING[plan].audience;
}

export function getPlanRoiLine(plan: PlanKey) {
  return PLAN_MARKETING[plan].roiLine;
}

export function getScoreTone(score: number) {
  if (score >= 90) {
    return {
      label: "Excellent",
      classes: "text-emerald-600",
      ring: "stroke-emerald-500",
      bg: "bg-emerald-500/10"
    };
  }

  if (score >= 50) {
    return {
      label: "Needs attention",
      classes: "text-amber-600",
      ring: "stroke-amber-500",
      bg: "bg-amber-500/10"
    };
  }

  return {
    label: "Critical",
    classes: "text-rose-600",
    ring: "stroke-rose-500",
    bg: "bg-rose-500/10"
  };
}

export function formatScoreDelta(delta: number | null | undefined) {
  if (delta === null || delta === undefined || Number.isNaN(delta)) {
    return "0";
  }

  return `${delta > 0 ? "+" : ""}${Math.round(delta)}`;
}

export function formatDateTime(value: string | Date | null | undefined) {
  if (!value) {
    return "Never";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(typeof value === "string" ? new Date(value) : value);
}

export function formatRelativeTime(value: string | Date | null | undefined) {
  if (!value) {
    return "Never";
  }

  return formatDistanceToNowStrict(typeof value === "string" ? new Date(value) : value, {
    addSuffix: true
  });
}

export function getBaseUrl() {
  return process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export function normalizeUrl(rawUrl: string) {
  const trimmed = rawUrl.trim();
  const value = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const parsed = new URL(value);

  return parsed.toString();
}

export function buildStoragePath(userId: string, fileName: string) {
  return `${userId}/${Date.now()}-${fileName.replace(/\s+/g, "-").toLowerCase()}`;
}

export function safeJsonParse<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
