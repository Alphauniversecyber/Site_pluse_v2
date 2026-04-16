import type { ScanFrequency } from "@/types";

type DateParts = {
  year: number;
  month: number;
  day: number;
};

function buildFormatter(timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
}

export function normalizeTimezone(timezone?: string | null) {
  const candidate = timezone?.trim();

  if (!candidate) {
    return "UTC";
  }

  try {
    buildFormatter(candidate).format(new Date());
    return candidate;
  } catch {
    return "UTC";
  }
}

function getDateParts(reference: Date, timezone: string): DateParts {
  const parts = buildFormatter(normalizeTimezone(timezone)).formatToParts(reference);

  const year = Number(parts.find((part) => part.type === "year")?.value ?? 0);
  const month = Number(parts.find((part) => part.type === "month")?.value ?? 1);
  const day = Number(parts.find((part) => part.type === "day")?.value ?? 1);

  return { year, month, day };
}

function toUtcCalendarDate(parts: DateParts) {
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function getIsoWeek(date: Date) {
  const value = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(value.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((value.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);

  return {
    year: value.getUTCFullYear(),
    week
  };
}

export function getLocalDayKey(reference: Date | string, timezone?: string | null) {
  const value = typeof reference === "string" ? new Date(reference) : reference;
  const parts = getDateParts(value, normalizeTimezone(timezone));
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

export function getPeriodKey(
  frequency: ScanFrequency,
  reference: Date | string,
  timezone?: string | null
) {
  const value = typeof reference === "string" ? new Date(reference) : reference;
  const date = toUtcCalendarDate(getDateParts(value, normalizeTimezone(timezone)));

  if (frequency === "daily") {
    return getLocalDayKey(value, timezone);
  }

  if (frequency === "monthly") {
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}`;
  }

  const isoWeek = getIsoWeek(date);
  return `${isoWeek.year}-W${pad(isoWeek.week)}`;
}

export function isDueForPeriod(input: {
  frequency: ScanFrequency;
  lastEventAt: string | null | undefined;
  timezone?: string | null;
  reference?: Date;
}) {
  if (!input.lastEventAt) {
    return true;
  }

  const reference = input.reference ?? new Date();
  return (
    getPeriodKey(input.frequency, input.lastEventAt, input.timezone) !==
    getPeriodKey(input.frequency, reference, input.timezone)
  );
}

export function getRetryAt(minutesFromNow: number) {
  return new Date(Date.now() + minutesFromNow * 60_000).toISOString();
}
