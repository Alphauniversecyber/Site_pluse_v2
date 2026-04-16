import type { BillingCycle, PlanKey, SubscriptionStatus, UserProfile } from "@/types";

import { ADMIN_CRON_DEFINITIONS, type AdminCronName } from "@/lib/admin/constants";
import { formatDateTime } from "@/lib/utils";

export type AdminUserState = "paid" | "trial" | "expired" | "cancelled" | "free";

export function startOfDayIso(reference = new Date()) {
  const value = new Date(reference);
  value.setHours(0, 0, 0, 0);
  return value.toISOString();
}

export function startOfMonthIso(reference = new Date()) {
  const value = new Date(reference.getFullYear(), reference.getMonth(), 1);
  return value.toISOString();
}

export function startOfPreviousMonthIso(reference = new Date()) {
  const value = new Date(reference.getFullYear(), reference.getMonth() - 1, 1);
  return value.toISOString();
}

export function formatAdminDate(value: string | Date | null | undefined) {
  return formatDateTime(value);
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

export function toMonthlyRevenue(price: number | null | undefined, cycle: BillingCycle | null | undefined) {
  if (!price) {
    return 0;
  }

  return cycle === "yearly" ? price / 12 : price;
}

export function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

export function getTrialDaysRemaining(input: Pick<UserProfile, "trial_ends_at">) {
  if (!input.trial_ends_at) {
    return 0;
  }

  const diff = new Date(input.trial_ends_at).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export function getAdminUserState(input: {
  is_trial: boolean;
  trial_ends_at: string | null;
  subscription_status: SubscriptionStatus | null;
  plan: PlanKey;
}) {
  if (input.subscription_status === "active") {
    return "paid" as const;
  }

  if (
    input.is_trial &&
    input.trial_ends_at &&
    new Date(input.trial_ends_at).getTime() > Date.now()
  ) {
    return "trial" as const;
  }

  if (
    input.is_trial &&
    input.trial_ends_at &&
    new Date(input.trial_ends_at).getTime() <= Date.now()
  ) {
    return "expired" as const;
  }

  if (input.subscription_status === "cancelled") {
    return "cancelled" as const;
  }

  return "free" as const;
}

export function getPlanLabel(plan: PlanKey) {
  if (plan === "starter") return "Growth";
  if (plan === "agency") return "Pro";
  return "Starter";
}

export function getStatusLabel(state: AdminUserState) {
  if (state === "paid") return "Active";
  if (state === "trial") return "Trial";
  if (state === "expired") return "Expired";
  if (state === "cancelled") return "Cancelled";
  return "Free";
}

export function getRowIndicatorColor(state: AdminUserState) {
  if (state === "paid") return "#22C55E";
  if (state === "trial") return "#3B82F6";
  if (state === "expired") return "#EF4444";
  if (state === "cancelled") return "#F59E0B";
  return "#6B7280";
}

export function getPlanTone(plan: PlanKey) {
  if (plan === "agency") return { background: "#082F49", color: "#7DD3FC", border: "#0F3C57" };
  if (plan === "starter") return { background: "#052E16", color: "#86EFAC", border: "#14532D" };
  return { background: "#1F2937", color: "#D1D5DB", border: "#374151" };
}

export function getStatusTone(state: AdminUserState) {
  if (state === "paid") return { background: "#052E16", color: "#86EFAC", border: "#14532D" };
  if (state === "trial") return { background: "#172554", color: "#93C5FD", border: "#1D4ED8" };
  if (state === "expired") return { background: "#450A0A", color: "#FCA5A5", border: "#7F1D1D" };
  if (state === "cancelled") return { background: "#451A03", color: "#FCD34D", border: "#78350F" };
  return { background: "#1F2937", color: "#D1D5DB", border: "#374151" };
}

export function getHealthTone(score: number | null | undefined) {
  if (score === null || score === undefined) {
    return { background: "#1F2937", color: "#D1D5DB", border: "#374151", label: "N/A" };
  }

  if (score >= 85) {
    return { background: "#052E16", color: "#86EFAC", border: "#14532D", label: `${score}` };
  }

  if (score >= 60) {
    return { background: "#451A03", color: "#FCD34D", border: "#78350F", label: `${score}` };
  }

  return { background: "#450A0A", color: "#FCA5A5", border: "#7F1D1D", label: `${score}` };
}

export function pickLatestDate(...values: Array<string | null | undefined>) {
  const valid = values.filter((value): value is string => Boolean(value));
  if (!valid.length) {
    return null;
  }

  return valid.sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] ?? null;
}

export function buildCsv(rows: string[][]) {
  return rows
    .map((row) =>
      row
        .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
        .join(",")
    )
    .join("\n");
}

export function getNextCronRun(cronName: AdminCronName, reference = new Date()) {
  const definition = ADMIN_CRON_DEFINITIONS[cronName];
  const [minuteRaw, hourRaw] = definition.schedule.split(" ");
  const minute = Number.parseInt(minuteRaw, 10);
  const hasFixedHour = hourRaw !== "*";
  const hour = hasFixedHour ? Number.parseInt(hourRaw, 10) : null;
  const next = new Date(reference);
  const minuteStep = /^\*\/\d+$/.test(minuteRaw) ? Number.parseInt(minuteRaw.slice(2), 10) : null;

  next.setSeconds(0, 0);

  if (!hasFixedHour && minuteStep && Number.isFinite(minuteStep) && minuteStep > 0) {
    const currentMinute = reference.getMinutes();
    const nextMinute = Math.ceil((currentMinute + 1) / minuteStep) * minuteStep;

    if (nextMinute >= 60) {
      next.setHours(reference.getHours() + 1, nextMinute % 60, 0, 0);
    } else {
      next.setHours(reference.getHours(), nextMinute, 0, 0);
    }

    return next.toISOString();
  }

  if (!hasFixedHour && Number.isFinite(minute)) {
    next.setMinutes(minute);
    if (next.getTime() <= reference.getTime()) {
      next.setHours(next.getHours() + 1);
    }
    return next.toISOString();
  }

  if (hour !== null && Number.isFinite(hour) && Number.isFinite(minute)) {
    next.setHours(hour, minute, 0, 0);
    if (next.getTime() <= reference.getTime()) {
      next.setDate(next.getDate() + 1);
    }
    return next.toISOString();
  }

  next.setHours(next.getHours() + 1);
  return next.toISOString();
}

export function formatDurationMs(startedAt: string | null | undefined, finishedAt: string | null | undefined) {
  if (!startedAt || !finishedAt) {
    return "Still running";
  }

  const diff = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  if (diff < 1000) {
    return `${diff} ms`;
  }

  const seconds = Math.round(diff / 100) / 10;
  return `${seconds}s`;
}

export function parsePageParam(raw: string | string[] | null | undefined, fallback: number) {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function parseTextParam(raw: string | string[] | null | undefined) {
  return (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";
}
