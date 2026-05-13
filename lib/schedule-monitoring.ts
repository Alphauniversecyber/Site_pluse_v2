import type { ScanFrequency } from "@/types";

type DateParts = {
  year: number;
  month: number;
  day: number;
};

function compareDateParts(left: DateParts, right: DateParts) {
  if (left.year !== right.year) {
    return left.year - right.year;
  }

  if (left.month !== right.month) {
    return left.month - right.month;
  }

  return left.day - right.day;
}

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

function fromUtcCalendarDate(value: Date): DateParts {
  return {
    year: value.getUTCFullYear(),
    month: value.getUTCMonth() + 1,
    day: value.getUTCDate()
  };
}

function addDays(parts: DateParts, days: number) {
  const value = toUtcCalendarDate(parts);
  value.setUTCDate(value.getUTCDate() + days);
  return fromUtcCalendarDate(value);
}

function addMonths(parts: DateParts, months: number) {
  const monthIndex = parts.month - 1 + months;
  const year = parts.year + Math.floor(monthIndex / 12);
  const normalizedMonthIndex = ((monthIndex % 12) + 12) % 12;
  const daysInTargetMonth = new Date(Date.UTC(year, normalizedMonthIndex + 1, 0)).getUTCDate();

  return {
    year,
    month: normalizedMonthIndex + 1,
    day: Math.min(parts.day, daysInTargetMonth)
  };
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
  const timezone = normalizeTimezone(input.timezone);
  const lastEventParts = getDateParts(new Date(input.lastEventAt), timezone);
  const referenceParts = getDateParts(reference, timezone);

  if (input.frequency === "daily") {
    return compareDateParts(lastEventParts, referenceParts) < 0;
  }

  if (input.frequency === "weekly") {
    return compareDateParts(addDays(lastEventParts, 7), referenceParts) <= 0;
  }

  return compareDateParts(addMonths(lastEventParts, 1), referenceParts) <= 0;
}

export function getRetryAt(minutesFromNow: number) {
  return new Date(Date.now() + minutesFromNow * 60_000).toISOString();
}
