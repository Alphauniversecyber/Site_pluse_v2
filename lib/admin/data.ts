import "server-only";

import type { BillingCycle, EmailTemplateId, PlanKey, SubscriptionStatus } from "@/types";

import {
  ADMIN_CRON_DEFINITIONS,
  ADMIN_CRON_NAMES,
  ADMIN_PAGE_SIZE,
  ADMIN_SUPABASE_EGRESS_THIS_MONTH,
  type AdminCronName
} from "@/lib/admin/constants";
import {
  formatCurrency,
  formatPercent,
  getAdminUserState,
  getNextCronRun,
  getPlanLabel,
  getTrialDaysRemaining,
  pickLatestDate,
  startOfDayIso,
  startOfMonthIso,
  startOfPreviousMonthIso,
  toMonthlyRevenue
} from "@/lib/admin/format";
import { executeAdminCron } from "@/lib/admin/cron-executor";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type AdminUserRecord = {
  id: string;
  email: string;
  full_name: string | null;
  plan: PlanKey;
  billing_cycle: BillingCycle | null;
  subscription_price: number | null;
  subscription_status: SubscriptionStatus | null;
  next_billing_date: string | null;
  trial_end_date: string | null;
  trial_ends_at: string | null;
  is_trial: boolean;
  created_at: string;
  updated_at: string;
};

type AdminWebsiteRecord = {
  id: string;
  user_id: string;
  url: string;
  label: string;
  is_active: boolean;
  email_reports_enabled: boolean;
  magic_token: string | null;
  gsc_property: string | null;
  gsc_connected_at: string | null;
  ga_property_id: string | null;
  ga_connected_at: string | null;
  created_at: string;
  updated_at: string;
};

type AdminScanRecord = {
  id: string;
  website_id: string;
  performance_score: number;
  seo_score: number;
  accessibility_score: number;
  best_practices_score: number;
  scan_status: "success" | "failed";
  error_message: string | null;
  scanned_at: string;
};

type AdminReportRecord = {
  id: string;
  website_id: string;
  scan_id: string;
  pdf_url: string;
  sent_to_email: string | null;
  sent_at: string | null;
  created_at: string;
};

type AdminCronLogRecord = {
  id: string;
  cron_name: AdminCronName;
  started_at: string;
  finished_at: string | null;
  status: "running" | "success" | "failed" | "timeout";
  items_processed: number | null;
  error_message: string | null;
  created_at: string;
};

type AdminEmailLogRecord = {
  id: string;
  to_email: string;
  subject: string;
  email_type: string;
  template_id: EmailTemplateId | null;
  dedupe_key: string | null;
  campaign: string | null;
  status: "sent" | "failed";
  website_id: string | null;
  user_id: string | null;
  provider: string | null;
  provider_message_id: string | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
  triggered_at: string;
  sent_at: string;
  created_at: string;
};

type AdminErrorLogRecord = {
  id: string;
  error_type: string;
  error_message: string;
  website_id: string | null;
  user_id: string | null;
  context: Record<string, unknown>;
  created_at: string;
};

export type AdminOverviewData = {
  stats: Array<{ label: string; value: string; tone: "neutral" | "green" | "blue" | "amber" | "red" }>;
  revenue: Array<{ label: string; value: string; note: string }>;
  health: Array<{ label: string; value: string; note: string; tone: "neutral" | "green" | "amber" | "red" }>;
  activity: Array<{
    id: string;
    type: string;
    title: string;
    detail: string;
    timestamp: string;
    tone: "green" | "blue" | "amber" | "red" | "neutral";
  }>;
  error: string | null;
};

export type AdminUsersPageData = {
  rows: Array<{
    id: string;
    email: string;
    name: string;
    plan: PlanKey;
    planLabel: string;
    state: ReturnType<typeof getAdminUserState>;
    trialEndsAt: string | null;
    websitesCount: number;
    websites: Array<{ id: string; label: string; url: string }>;
    joinedAt: string;
    lastActiveAt: string | null;
    subscriptionStatus: SubscriptionStatus | null;
    billingCycle: BillingCycle | null;
    subscriptionPrice: number | null;
    nextBillingDate: string | null;
    reportsSentCount: number;
    lastScanAt: string | null;
  }>;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  error: string | null;
};

export type AdminWebsitesPageData = {
  rows: Array<{
    id: string;
    url: string;
    label: string;
    ownerEmail: string;
    ownerId: string;
    healthScore: number | null;
    lastScanAt: string | null;
    scanStatus: "success" | "failed" | "pending";
    reportsSent: number;
    gscConnected: boolean;
    gaConnected: boolean;
    createdAt: string;
    scanHistory: AdminScanRecord[];
    reports: AdminReportRecord[];
    connectionDetails: {
      gscProperty: string | null;
      gscConnectedAt: string | null;
      gaPropertyId: string | null;
      gaConnectedAt: string | null;
      magicTokenPresent: boolean;
    };
  }>;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  error: string | null;
};

export type AdminReportsPageData = {
  rows: Array<{
    id: string;
    websiteId: string;
    websiteUrl: string;
    ownerEmail: string;
    sentTo: string;
    sentAt: string | null;
    hasPdf: boolean;
    reportType: "daily" | "weekly" | "monthly" | "manual";
    status: "sent" | "failed";
    createdAt: string;
  }>;
  totals: {
    sentThisMonth: number;
    failedThisMonth: number;
  };
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  error: string | null;
};

export type AdminCronsPageData = {
  rows: Array<{
    name: AdminCronName;
    schedule: string;
    path: string;
    description: string;
    lastRunAt: string | null;
    lastRunStatus: "running" | "success" | "failed" | "timeout" | "never";
    lastRunDuration: string;
    itemsProcessed: number;
    nextRunAt: string;
    history: AdminCronLogRecord[];
  }>;
  error: string | null;
};

export type AdminEmailsPageData = {
  rows: Array<{
    id: string;
    to: string;
    subject: string;
    type: string;
    sentAt: string;
    status: "sent" | "failed";
    websiteLabel: string;
    errorMessage: string | null;
  }>;
  stats: {
    sentToday: number;
    sentThisMonth: number;
    failedThisMonth: number;
    mostActiveRecipient: string;
  };
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  error: string | null;
};

export type AdminBillingPageData = {
  paidUsers: Array<{
    id: string;
    email: string;
    plan: PlanKey;
    planLabel: string;
    amountLabel: string;
    billingCycle: BillingCycle | null;
    status: SubscriptionStatus | null;
    nextBillingDate: string | null;
  }>;
  trialUsers: Array<{
    id: string;
    email: string;
    daysRemaining: number;
    trialEndsAt: string | null;
  }>;
  expiredTrials: Array<{
    id: string;
    email: string;
    trialEndedAt: string | null;
  }>;
  summary: {
    mrr: string;
    revenueThisMonth: string;
    revenueLastMonth: string;
  };
  error: string | null;
};

export type AdminErrorsPageData = {
  rows: Array<{
    id: string;
    type: string;
    message: string;
    websiteUrl: string;
    userEmail: string;
    createdAt: string;
    context: Record<string, unknown>;
  }>;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  error: string | null;
};

function chunkPage<T>(rows: T[], page: number, pageSize: number, exportAll = false) {
  if (exportAll) {
    return {
      items: rows,
      total: rows.length,
      totalPages: rows.length ? 1 : 0
    };
  }

  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  return {
    items: rows.slice(start, start + pageSize),
    total,
    totalPages
  };
}

function latestByWebsite<T extends { website_id: string; scanned_at?: string; sent_at?: string; created_at?: string }>(
  rows: T[]
) {
  const map = new Map<string, T>();

  rows.forEach((row) => {
    const current = map.get(row.website_id);
    const candidateDate = row.scanned_at ?? row.sent_at ?? row.created_at ?? "";
    const currentDate = current?.scanned_at ?? current?.sent_at ?? current?.created_at ?? "";

    if (!current || new Date(candidateDate).getTime() > new Date(currentDate).getTime()) {
      map.set(row.website_id, row);
    }
  });

  return map;
}

function groupByWebsite<T extends { website_id: string }>(rows: T[]) {
  return rows.reduce<Record<string, T[]>>((accumulator, row) => {
    accumulator[row.website_id] = accumulator[row.website_id] ?? [];
    accumulator[row.website_id]?.push(row);
    return accumulator;
  }, {});
}

function computeScanHealth(scan: AdminScanRecord | null | undefined) {
  if (!scan) {
    return null;
  }

  return Math.round(
    (scan.performance_score + scan.seo_score + scan.accessibility_score + scan.best_practices_score) / 4
  );
}

function parseRecipients(value: string | null | undefined) {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

async function loadUsersByIds(ids: string[]) {
  if (!ids.length) {
    return new Map<string, AdminUserRecord>();
  }

  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("users")
    .select(
      "id,email,full_name,plan,billing_cycle,subscription_price,subscription_status,next_billing_date,trial_end_date,trial_ends_at,is_trial,created_at,updated_at"
    )
    .in("id", ids);

  return new Map(((data ?? []) as AdminUserRecord[]).map((row) => [row.id, row]));
}

async function loadWebsitesByIds(ids: string[]) {
  if (!ids.length) {
    return new Map<string, AdminWebsiteRecord>();
  }

  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("websites")
    .select(
      "id,user_id,url,label,is_active,email_reports_enabled,magic_token,gsc_property,gsc_connected_at,ga_property_id,ga_connected_at,created_at,updated_at"
    )
    .in("id", ids);

  return new Map(((data ?? []) as AdminWebsiteRecord[]).map((row) => [row.id, row]));
}

export async function getAdminOverviewData(): Promise<AdminOverviewData> {
  const admin = createSupabaseAdminClient();
  const nowIso = new Date().toISOString();
  const todayIso = startOfDayIso();
  const monthIso = startOfMonthIso();

  try {
    const [
      totalUsersResult,
      activeTrialsResult,
      expiredTrialsResult,
      paidUsersResult,
      totalWebsitesResult,
      scansTodayResult,
      failedScansTodayResult,
      mrrUsersResult,
      cronLogsResult,
      newUsersResult,
      reportRowsResult,
      failedScansResult,
      paymentRowsResult,
      expiredRowsResult
    ] = await Promise.all([
      admin.from("users").select("*", { head: true, count: "exact" }),
      admin
        .from("users")
        .select("*", { head: true, count: "exact" })
        .eq("is_trial", true)
        .gt("trial_ends_at", nowIso),
      admin
        .from("users")
        .select("*", { head: true, count: "exact" })
        .eq("is_trial", true)
        .lt("trial_ends_at", nowIso),
      admin
        .from("users")
        .select("*", { head: true, count: "exact" })
        .eq("subscription_status", "active"),
      admin.from("websites").select("*", { head: true, count: "exact" }),
      admin
        .from("scan_results")
        .select("*", { head: true, count: "exact" })
        .gte("scanned_at", todayIso),
      admin
        .from("scan_results")
        .select("*", { head: true, count: "exact" })
        .eq("scan_status", "failed")
        .gte("scanned_at", todayIso),
      admin
        .from("users")
        .select(
          "id,subscription_price,billing_cycle,subscription_status,trial_end_date,updated_at,email"
        )
        .in("subscription_status", ["active", "cancelled"]),
      admin
        .from("cron_logs")
        .select("id,cron_name,started_at,finished_at,status,items_processed,error_message,created_at")
        .order("started_at", { ascending: false })
        .limit(50),
      admin.from("users").select("id,email,created_at").order("created_at", { ascending: false }).limit(10),
      admin
        .from("reports")
        .select("id,website_id,sent_at,sent_to_email")
        .not("sent_at", "is", null)
        .order("sent_at", { ascending: false })
        .limit(10),
      admin
        .from("scan_results")
        .select("id,website_id,error_message,scanned_at")
        .eq("scan_status", "failed")
        .order("scanned_at", { ascending: false })
        .limit(10),
      admin
        .from("users")
        .select("id,email,subscription_price,updated_at")
        .eq("subscription_status", "active")
        .not("subscription_price", "is", null)
        .gte("updated_at", monthIso)
        .order("updated_at", { ascending: false })
        .limit(10),
      admin
        .from("users")
        .select("id,email,updated_at,trial_end_date")
        .not("trial_end_date", "is", null)
        .lt("trial_end_date", nowIso)
        .neq("subscription_status", "active")
        .order("updated_at", { ascending: false })
        .limit(10)
    ]);

    const mrrUsers = (mrrUsersResult.data ?? []) as Array<{
      id: string;
      subscription_price: number | null;
      billing_cycle: BillingCycle | null;
      subscription_status: SubscriptionStatus | null;
      trial_end_date: string | null;
      updated_at: string;
      email: string;
    }>;
    const paidUsers = mrrUsers.filter((row) => row.subscription_status === "active");
    const historicalTrials = mrrUsers.filter((row) => row.trial_end_date).length;
    const churnThisMonth = mrrUsers.filter(
      (row) =>
        row.subscription_status === "cancelled" &&
        new Date(row.updated_at).getTime() >= new Date(monthIso).getTime()
    ).length;
    const mrr = paidUsers.reduce(
      (sum, row) => sum + toMonthlyRevenue(row.subscription_price, row.billing_cycle),
      0
    );
    const conversionRate = historicalTrials ? (paidUsers.length / historicalTrials) * 100 : 0;

    const cronLogs = (cronLogsResult.data ?? []) as AdminCronLogRecord[];
    const scanCronLog = cronLogs.find((row) => row.cron_name === "process-scans") ?? null;
    const reportCronLog = cronLogs.find((row) => row.cron_name === "process-reports") ?? null;

    const websiteIds = Array.from(
      new Set([
        ...((reportRowsResult.data ?? []) as Array<{ website_id: string }>).map((row) => row.website_id),
        ...((failedScansResult.data ?? []) as Array<{ website_id: string }>).map((row) => row.website_id)
      ])
    );
    const websitesById = await loadWebsitesByIds(websiteIds);

    const activity = [
      ...((newUsersResult.data ?? []) as Array<{ id: string; email: string; created_at: string }>).map((row) => ({
        id: `signup-${row.id}`,
        type: "New signup",
        title: row.email,
        detail: "A new user created an account.",
        timestamp: row.created_at,
        tone: "blue" as const
      })),
      ...((expiredRowsResult.data ?? []) as Array<{ id: string; email: string; updated_at: string }>).map((row) => ({
        id: `trial-expired-${row.id}`,
        type: "Trial expired",
        title: row.email,
        detail: "Trial access ended and this account needs a paid conversion.",
        timestamp: row.updated_at,
        tone: "amber" as const
      })),
      ...((reportRowsResult.data ?? []) as Array<{ id: string; website_id: string; sent_at: string; sent_to_email: string | null }>).map((row) => ({
        id: `report-${row.id}`,
        type: "Report sent",
        title: websitesById.get(row.website_id)?.label ?? websitesById.get(row.website_id)?.url ?? "Unknown website",
        detail: parseRecipients(row.sent_to_email).join(", ") || "Sent to saved recipients",
        timestamp: row.sent_at,
        tone: "green" as const
      })),
      ...((failedScansResult.data ?? []) as Array<{ id: string; website_id: string; error_message: string | null; scanned_at: string }>).map((row) => ({
        id: `scan-failed-${row.id}`,
        type: "Scan failed",
        title: websitesById.get(row.website_id)?.label ?? websitesById.get(row.website_id)?.url ?? "Unknown website",
        detail: row.error_message ?? "Unknown scan failure.",
        timestamp: row.scanned_at,
        tone: "red" as const
      })),
      ...((paymentRowsResult.data ?? []) as Array<{ id: string; email: string; subscription_price: number | null; updated_at: string }>).map((row) => ({
        id: `payment-${row.id}`,
        type: "Payment received",
        title: row.email,
        detail: `Approx. ${formatCurrency(row.subscription_price ?? 0)} in new paid billing activity.`,
        timestamp: row.updated_at,
        tone: "green" as const
      }))
    ]
      .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())
      .slice(0, 10);

    return {
      stats: [
        { label: "Total Users", value: String(totalUsersResult.count ?? 0), tone: "neutral" },
        { label: "Active Trial Users", value: String(activeTrialsResult.count ?? 0), tone: "blue" },
        { label: "Expired Trials", value: String(expiredTrialsResult.count ?? 0), tone: "amber" },
        { label: "Paid Users", value: String(paidUsersResult.count ?? 0), tone: "green" },
        { label: "Total Websites", value: String(totalWebsitesResult.count ?? 0), tone: "neutral" },
        { label: "Scans Today", value: String(scansTodayResult.count ?? 0), tone: "blue" }
      ],
      revenue: [
        {
          label: "MRR",
          value: formatCurrency(Math.round(mrr)),
          note: "Calculated from active paid users."
        },
        {
          label: "Trial → Paid Conversion",
          value: formatPercent(conversionRate),
          note: `${paidUsers.length} paid users from ${historicalTrials} historical trial accounts.`
        },
        {
          label: "Churn This Month",
          value: String(churnThisMonth),
          note: "Cancelled subscriptions updated this month."
        }
      ],
      health: [
        {
          label: "Last cron run: process-scans",
          value: scanCronLog?.started_at ?? "Never",
          note:
            scanCronLog?.status === "running"
              ? "Currently running"
              : scanCronLog?.status ?? "No cron log yet",
          tone: scanCronLog?.status === "failed" ? "red" : scanCronLog?.status === "timeout" ? "amber" : "green"
        },
        {
          label: "Last cron run: process-reports",
          value: reportCronLog?.started_at ?? "Never",
          note:
            reportCronLog?.status === "running"
              ? "Currently running"
              : reportCronLog?.status ?? "No cron log yet",
          tone: reportCronLog?.status === "failed" ? "red" : reportCronLog?.status === "timeout" ? "amber" : "green"
        },
        {
          label: "Supabase egress this month",
          value: ADMIN_SUPABASE_EGRESS_THIS_MONTH,
          note: "Manual value. Update in lib/admin/constants.ts.",
          tone: "amber"
        },
        {
          label: "Failed scans today",
          value: String(failedScansTodayResult.count ?? 0),
          note: "scan_results rows with failed status today.",
          tone: (failedScansTodayResult.count ?? 0) > 0 ? "red" : "green"
        }
      ],
      activity,
      error: null
    };
  } catch (error) {
    return {
      stats: [],
      revenue: [],
      health: [],
      activity: [],
      error: error instanceof Error ? error.message : "Unable to load admin overview."
    };
  }
}

export async function getAdminUsersData(input: {
  search?: string;
  filter?: string;
  sort?: string;
  page?: number;
  pageSize?: number;
  exportAll?: boolean;
}): Promise<AdminUsersPageData> {
  const admin = createSupabaseAdminClient();
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? ADMIN_PAGE_SIZE;

  try {
    const { data, error } = await admin
      .from("users")
      .select(
        "id,email,full_name,plan,billing_cycle,subscription_price,subscription_status,next_billing_date,trial_end_date,trial_ends_at,is_trial,created_at,updated_at"
      )
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    const search = input.search?.toLowerCase().trim() ?? "";
    const filter = input.filter ?? "all";
    const sort = input.sort ?? "newest";

    let rows = ((data ?? []) as AdminUserRecord[]).filter((row) => {
      const state = getAdminUserState(row);
      const matchesSearch =
        !search ||
        row.email.toLowerCase().includes(search) ||
        (row.full_name ?? "").toLowerCase().includes(search);

      const matchesFilter =
        filter === "all" ||
        (filter === "trial" && state === "trial") ||
        (filter === "paid" && state === "paid") ||
        (filter === "expired" && state === "expired") ||
        (filter === "free" && state === "free");

      return matchesSearch && matchesFilter;
    });

    rows = rows.sort((left, right) => {
      if (sort === "oldest") {
        return new Date(left.created_at).getTime() - new Date(right.created_at).getTime();
      }

      if (sort === "plan") {
        const rank: Record<PlanKey, number> = { agency: 0, starter: 1, free: 2 };
        return rank[left.plan] - rank[right.plan] || left.email.localeCompare(right.email);
      }

      return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
    });

    const { items: pagedUsers, total, totalPages } = chunkPage(rows, page, pageSize, input.exportAll);
    const userIds = pagedUsers.map((row) => row.id);

    const { data: websitesData } = userIds.length
      ? await admin
          .from("websites")
          .select(
            "id,user_id,url,label,is_active,email_reports_enabled,magic_token,gsc_property,gsc_connected_at,ga_property_id,ga_connected_at,created_at,updated_at"
          )
          .in("user_id", userIds)
      : { data: [] };

    const websites = (websitesData ?? []) as AdminWebsiteRecord[];
    const websitesByUser = websites.reduce<Record<string, AdminWebsiteRecord[]>>((accumulator, website) => {
      accumulator[website.user_id] = accumulator[website.user_id] ?? [];
      accumulator[website.user_id]?.push(website);
      return accumulator;
    }, {});

    const websiteIds = websites.map((row) => row.id);

    const [scanRowsResult, reportRowsResult] = await Promise.all([
      websiteIds.length
        ? admin
            .from("scan_results")
            .select(
              "id,website_id,performance_score,seo_score,accessibility_score,best_practices_score,scan_status,error_message,scanned_at"
            )
            .in("website_id", websiteIds)
            .order("scanned_at", { ascending: false })
        : Promise.resolve({ data: [] as AdminScanRecord[] }),
      websiteIds.length
        ? admin
            .from("reports")
            .select("id,website_id,scan_id,pdf_url,sent_to_email,sent_at,created_at")
            .in("website_id", websiteIds)
        : Promise.resolve({ data: [] as AdminReportRecord[] })
    ]);

    const latestScans = latestByWebsite((scanRowsResult.data ?? []) as AdminScanRecord[]);
    const reportsByWebsite = groupByWebsite((reportRowsResult.data ?? []) as AdminReportRecord[]);

    return {
      rows: pagedUsers.map((user) => {
        const ownedWebsites = websitesByUser[user.id] ?? [];
        const reportCounts = ownedWebsites.reduce((sum, website) => {
          const sentReports = (reportsByWebsite[website.id] ?? []).filter((row) => row.sent_at).length;
          return sum + sentReports;
        }, 0);
        const lastScanAt = pickLatestDate(
          ...ownedWebsites.map((website) => latestScans.get(website.id)?.scanned_at ?? null)
        );
        const lastReportAt = pickLatestDate(
          ...ownedWebsites.flatMap((website) => (reportsByWebsite[website.id] ?? []).map((row) => row.sent_at))
        );

        return {
          id: user.id,
          email: user.email,
          name: user.full_name ?? "Unnamed user",
          plan: user.plan,
          planLabel: getPlanLabel(user.plan),
          state: getAdminUserState(user),
          trialEndsAt: user.trial_ends_at,
          websitesCount: ownedWebsites.length,
          websites: ownedWebsites.map((website) => ({
            id: website.id,
            label: website.label,
            url: website.url
          })),
          joinedAt: user.created_at,
          lastActiveAt: pickLatestDate(user.updated_at, lastScanAt, lastReportAt),
          subscriptionStatus: user.subscription_status,
          billingCycle: user.billing_cycle,
          subscriptionPrice: user.subscription_price,
          nextBillingDate: user.next_billing_date,
          reportsSentCount: reportCounts,
          lastScanAt
        };
      }),
      total,
      page,
      pageSize,
      totalPages,
      error: null
    };
  } catch (error) {
    return {
      rows: [],
      total: 0,
      page,
      pageSize,
      totalPages: 0,
      error: error instanceof Error ? error.message : "Unable to load users."
    };
  }
}

export async function getAdminWebsitesData(input: {
  search?: string;
  filter?: string;
  page?: number;
  pageSize?: number;
}): Promise<AdminWebsitesPageData> {
  const admin = createSupabaseAdminClient();
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? ADMIN_PAGE_SIZE;

  try {
    const { data, error } = await admin
      .from("websites")
      .select(
        "id,user_id,url,label,is_active,email_reports_enabled,magic_token,gsc_property,gsc_connected_at,ga_property_id,ga_connected_at,created_at,updated_at"
      )
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    const websites = (data ?? []) as AdminWebsiteRecord[];
    const usersById = await loadUsersByIds(Array.from(new Set(websites.map((row) => row.user_id))));
    const search = input.search?.toLowerCase().trim() ?? "";

    const websiteIds = websites.map((row) => row.id);
    const [scanRowsResult, reportRowsResult] = await Promise.all([
      websiteIds.length
        ? admin
            .from("scan_results")
            .select(
              "id,website_id,performance_score,seo_score,accessibility_score,best_practices_score,scan_status,error_message,scanned_at"
            )
            .in("website_id", websiteIds)
            .order("scanned_at", { ascending: false })
        : Promise.resolve({ data: [] as AdminScanRecord[] }),
      websiteIds.length
        ? admin
            .from("reports")
            .select("id,website_id,scan_id,pdf_url,sent_to_email,sent_at,created_at")
            .in("website_id", websiteIds)
        : Promise.resolve({ data: [] as AdminReportRecord[] })
    ]);

    const scans = (scanRowsResult.data ?? []) as AdminScanRecord[];
    const reports = (reportRowsResult.data ?? []) as AdminReportRecord[];
    const latestScans = latestByWebsite(scans);
    const scansByWebsite = groupByWebsite(scans);
    const reportsByWebsite = groupByWebsite(reports);

    const filtered = websites.filter((website) => {
      const ownerEmail = usersById.get(website.user_id)?.email ?? "";
      const latestScan = latestScans.get(website.id) ?? null;
      const matchesSearch =
        !search ||
        website.url.toLowerCase().includes(search) ||
        website.label.toLowerCase().includes(search) ||
        ownerEmail.toLowerCase().includes(search);

      const filter = input.filter ?? "all";
      const matchesFilter =
        filter === "all" ||
        (filter === "scan_failed" && latestScan?.scan_status === "failed") ||
        (filter === "gsc_connected" && Boolean(website.gsc_property)) ||
        (filter === "ga_connected" && Boolean(website.ga_property_id));

      return matchesSearch && matchesFilter;
    });

    const { items, total, totalPages } = chunkPage(filtered, page, pageSize);

    return {
      rows: items.map((website) => {
        const latestScan = latestScans.get(website.id) ?? null;
        return {
          id: website.id,
          url: website.url,
          label: website.label,
          ownerEmail: usersById.get(website.user_id)?.email ?? "Unknown owner",
          ownerId: website.user_id,
          healthScore: computeScanHealth(latestScan),
          lastScanAt: latestScan?.scanned_at ?? null,
          scanStatus: latestScan?.scan_status ?? "pending",
          reportsSent: (reportsByWebsite[website.id] ?? []).filter((row) => row.sent_at).length,
          gscConnected: Boolean(website.gsc_property),
          gaConnected: Boolean(website.ga_property_id),
          createdAt: website.created_at,
          scanHistory: scansByWebsite[website.id] ?? [],
          reports: reportsByWebsite[website.id] ?? [],
          connectionDetails: {
            gscProperty: website.gsc_property,
            gscConnectedAt: website.gsc_connected_at,
            gaPropertyId: website.ga_property_id,
            gaConnectedAt: website.ga_connected_at,
            magicTokenPresent: Boolean(website.magic_token)
          }
        };
      }),
      total,
      page,
      pageSize,
      totalPages,
      error: null
    };
  } catch (error) {
    return {
      rows: [],
      total: 0,
      page,
      pageSize,
      totalPages: 0,
      error: error instanceof Error ? error.message : "Unable to load websites."
    };
  }
}

export async function getAdminReportsData(input: {
  filter?: string;
  page?: number;
  pageSize?: number;
}): Promise<AdminReportsPageData> {
  const admin = createSupabaseAdminClient();
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? ADMIN_PAGE_SIZE;
  const monthIso = startOfMonthIso();
  const last7Iso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const last30Iso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  try {
    const [{ data, error }, { data: reportLogData, error: reportLogError }] = await Promise.all([
      admin
        .from("reports")
        .select("id,website_id,scan_id,pdf_url,sent_to_email,sent_at,created_at")
        .order("created_at", { ascending: false }),
      admin
        .from("email_logs")
        .select(
          "id,to_email,subject,email_type,template_id,dedupe_key,campaign,status,website_id,user_id,provider,provider_message_id,error_message,metadata,triggered_at,sent_at,created_at"
        )
        .eq("email_type", "report")
        .order("sent_at", { ascending: false })
        .limit(1000)
    ]);

    if (error) {
      throw new Error(error.message);
    }

    if (reportLogError) {
      throw new Error(reportLogError.message);
    }

    const reports = (data ?? []) as AdminReportRecord[];
    const reportLogs = (reportLogData ?? []) as AdminEmailLogRecord[];
    const websitesById = await loadWebsitesByIds(Array.from(new Set(reports.map((row) => row.website_id))));
    const usersById = await loadUsersByIds(
      Array.from(new Set(Array.from(websitesById.values()).map((row) => row.user_id)))
    );
    const latestReportLogByReportId = new Map<string, AdminEmailLogRecord>();

    for (const row of reportLogs) {
      const reportId = typeof row.metadata.reportId === "string" ? row.metadata.reportId : null;
      if (!reportId) {
        continue;
      }

      if (!latestReportLogByReportId.has(reportId)) {
        latestReportLogByReportId.set(reportId, row);
      }
    }

    const filter = input.filter ?? "all";
    const filtered = reports.filter((report) => {
      const sentAtOrCreatedAt = report.sent_at ?? report.created_at;
      if (filter === "sent") {
        return Boolean(report.sent_at);
      }
      if (filter === "failed") {
        return !report.sent_at;
      }
      if (filter === "last7") {
        return new Date(sentAtOrCreatedAt).getTime() >= new Date(last7Iso).getTime();
      }
      if (filter === "last30") {
        return new Date(sentAtOrCreatedAt).getTime() >= new Date(last30Iso).getTime();
      }
      return true;
    });

    const { items, total, totalPages } = chunkPage(filtered, page, pageSize);

    return {
      rows: items.map((report) => {
        const website = websitesById.get(report.website_id);
        const owner = website ? usersById.get(website.user_id) : null;
        const reportLog = latestReportLogByReportId.get(report.id);
        const reportType =
          reportLog?.campaign === "report_daily"
            ? "daily"
            : reportLog?.template_id === "report_monthly" || reportLog?.campaign === "report_monthly"
              ? "monthly"
              : reportLog?.template_id === "report_manual" || reportLog?.campaign === "report_manual"
                ? "manual"
                : website?.email_reports_enabled
                  ? "weekly"
                  : "manual";
        return {
          id: report.id,
          websiteId: report.website_id,
          websiteUrl: website?.url ?? "Unknown website",
          ownerEmail: owner?.email ?? "Unknown owner",
          sentTo: report.sent_to_email ?? "No recipient saved",
          sentAt: report.sent_at,
          hasPdf: Boolean(report.pdf_url),
          reportType,
          status: report.sent_at ? "sent" : "failed",
          createdAt: report.created_at
        };
      }),
      totals: {
        sentThisMonth: reports.filter(
          (report) => report.sent_at && new Date(report.sent_at).getTime() >= new Date(monthIso).getTime()
        ).length,
        failedThisMonth: reports.filter(
          (report) =>
            !report.sent_at && new Date(report.created_at).getTime() >= new Date(monthIso).getTime()
        ).length
      },
      total,
      page,
      pageSize,
      totalPages,
      error: null
    };
  } catch (error) {
    return {
      rows: [],
      totals: {
        sentThisMonth: 0,
        failedThisMonth: 0
      },
      total: 0,
      page,
      pageSize,
      totalPages: 0,
      error: error instanceof Error ? error.message : "Unable to load reports."
    };
  }
}

export async function getAdminCronsData(): Promise<AdminCronsPageData> {
  const admin = createSupabaseAdminClient();

  try {
    const { data, error } = await admin
      .from("cron_logs")
      .select("id,cron_name,started_at,finished_at,status,items_processed,error_message,created_at")
      .order("started_at", { ascending: false })
      .limit(200);

    if (error) {
      throw new Error(error.message);
    }

    const logs = (data ?? []) as AdminCronLogRecord[];

    return {
      rows: ADMIN_CRON_NAMES.map((cronName) => {
        const history = logs.filter((row) => row.cron_name === cronName).slice(0, 10);
        const latest = history[0] ?? null;
        const definition = ADMIN_CRON_DEFINITIONS[cronName];

        return {
          name: cronName,
          schedule: definition.schedule,
          path: definition.path,
          description: definition.description,
          lastRunAt: latest?.started_at ?? null,
          lastRunStatus: latest?.status ?? "never",
          lastRunDuration:
            latest?.started_at && latest?.finished_at
              ? `${Math.round((new Date(latest.finished_at).getTime() - new Date(latest.started_at).getTime()) / 100) / 10}s`
              : latest?.status === "running"
                ? "Still running"
                : "N/A",
          itemsProcessed: latest?.items_processed ?? 0,
          nextRunAt: getNextCronRun(cronName),
          history
        };
      }),
      error: null
    };
  } catch (error) {
    return {
      rows: ADMIN_CRON_NAMES.map((cronName) => {
        const definition = ADMIN_CRON_DEFINITIONS[cronName];
        return {
          name: cronName,
          schedule: definition.schedule,
          path: definition.path,
          description: definition.description,
          lastRunAt: null,
          lastRunStatus: "never",
          lastRunDuration: "N/A",
          itemsProcessed: 0,
          nextRunAt: getNextCronRun(cronName),
          history: []
        };
      }),
      error: error instanceof Error ? error.message : "Unable to load cron logs."
    };
  }
}

export async function getAdminEmailsData(input: {
  page?: number;
  pageSize?: number;
} = {}): Promise<AdminEmailsPageData> {
  const admin = createSupabaseAdminClient();
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? ADMIN_PAGE_SIZE;
  const todayIso = startOfDayIso();
  const monthIso = startOfMonthIso();

  try {
    const { data, error } = await admin
      .from("email_logs")
      .select(
        "id,to_email,subject,email_type,template_id,dedupe_key,campaign,status,website_id,user_id,provider,provider_message_id,error_message,metadata,triggered_at,sent_at,created_at"
      )
      .order("sent_at", { ascending: false })
      .limit(500);

    if (error) {
      throw new Error(error.message);
    }

    const logs = (data ?? []) as AdminEmailLogRecord[];
    const websitesById = await loadWebsitesByIds(
      Array.from(new Set(logs.map((row) => row.website_id).filter((value): value is string => Boolean(value))))
    );

    const { items, total, totalPages } = chunkPage(logs, page, pageSize);
    const recipientCounts = logs.reduce<Record<string, number>>((accumulator, row) => {
      accumulator[row.to_email] = (accumulator[row.to_email] ?? 0) + 1;
      return accumulator;
    }, {});
    const mostActiveRecipient =
      Object.entries(recipientCounts).sort((left, right) => right[1] - left[1])[0]?.[0] ?? "N/A";

    return {
      rows: items.map((row) => ({
        id: row.id,
        to: row.to_email,
        subject: row.subject,
        type: row.template_id ?? row.email_type,
        sentAt: row.sent_at,
        status: row.status,
        websiteLabel:
          websitesById.get(row.website_id ?? "")?.label ??
          websitesById.get(row.website_id ?? "")?.url ??
          "—",
        errorMessage: row.error_message
      })),
      stats: {
        sentToday: logs.filter((row) => new Date(row.sent_at).getTime() >= new Date(todayIso).getTime()).length,
        sentThisMonth: logs.filter((row) => new Date(row.sent_at).getTime() >= new Date(monthIso).getTime()).length,
        failedThisMonth: logs.filter(
          (row) =>
            row.status === "failed" && new Date(row.sent_at).getTime() >= new Date(monthIso).getTime()
        ).length,
        mostActiveRecipient
      },
      total,
      page,
      pageSize,
      totalPages,
      error: null
    };
  } catch (error) {
    return {
      rows: [],
      stats: {
        sentToday: 0,
        sentThisMonth: 0,
        failedThisMonth: 0,
        mostActiveRecipient: "N/A"
      },
      total: 0,
      page,
      pageSize,
      totalPages: 0,
      error: error instanceof Error ? error.message : "Unable to load email logs."
    };
  }
}

export async function getAdminBillingData(): Promise<AdminBillingPageData> {
  const admin = createSupabaseAdminClient();
  const monthIso = startOfMonthIso();
  const previousMonthIso = startOfPreviousMonthIso();

  try {
    const { data, error } = await admin
      .from("users")
      .select(
        "id,email,plan,billing_cycle,subscription_price,subscription_status,next_billing_date,trial_end_date,trial_ends_at,is_trial,updated_at"
      )
      .order("updated_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    const users = (data ?? []) as Array<
      Pick<
        AdminUserRecord,
        | "id"
        | "email"
        | "plan"
        | "billing_cycle"
        | "subscription_price"
        | "subscription_status"
        | "next_billing_date"
        | "trial_end_date"
        | "trial_ends_at"
        | "is_trial"
        | "updated_at"
      >
    >;
    const paidUsers = users.filter((row) => row.subscription_status === "active" && row.subscription_price);
    const trialUsers = users.filter((row) => getAdminUserState(row) === "trial");
    const expiredTrials = users.filter((row) => getAdminUserState(row) === "expired");
    const mrr = paidUsers.reduce(
      (sum, row) => sum + toMonthlyRevenue(row.subscription_price, row.billing_cycle),
      0
    );
    const revenueThisMonth = users
      .filter(
        (row) =>
          row.subscription_status === "active" &&
          new Date(row.updated_at).getTime() >= new Date(monthIso).getTime()
      )
      .reduce((sum, row) => sum + (row.subscription_price ?? 0), 0);
    const revenueLastMonth = users
      .filter((row) => {
        const updatedAt = new Date(row.updated_at).getTime();
        return (
          row.subscription_status === "active" &&
          updatedAt >= new Date(previousMonthIso).getTime() &&
          updatedAt < new Date(monthIso).getTime()
        );
      })
      .reduce((sum, row) => sum + (row.subscription_price ?? 0), 0);

    return {
      paidUsers: paidUsers.map((row) => ({
        id: row.id,
        email: row.email,
        plan: row.plan,
        planLabel: getPlanLabel(row.plan),
        amountLabel: formatCurrency(row.subscription_price ?? 0),
        billingCycle: row.billing_cycle,
        status: row.subscription_status,
        nextBillingDate: row.next_billing_date
      })),
      trialUsers: trialUsers.map((row) => ({
        id: row.id,
        email: row.email,
        daysRemaining: getTrialDaysRemaining(row),
        trialEndsAt: row.trial_ends_at
      })),
      expiredTrials: expiredTrials.map((row) => ({
        id: row.id,
        email: row.email,
        trialEndedAt: row.trial_ends_at
      })),
      summary: {
        mrr: formatCurrency(Math.round(mrr)),
        revenueThisMonth: formatCurrency(revenueThisMonth),
        revenueLastMonth: formatCurrency(revenueLastMonth)
      },
      error: null
    };
  } catch (error) {
    return {
      paidUsers: [],
      trialUsers: [],
      expiredTrials: [],
      summary: {
        mrr: formatCurrency(0),
        revenueThisMonth: formatCurrency(0),
        revenueLastMonth: formatCurrency(0)
      },
      error: error instanceof Error ? error.message : "Unable to load billing data."
    };
  }
}

export async function getAdminErrorsData(input: {
  type?: string;
  range?: string;
  page?: number;
  pageSize?: number;
} = {}): Promise<AdminErrorsPageData> {
  const admin = createSupabaseAdminClient();
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? ADMIN_PAGE_SIZE;
  const threshold =
    input.range === "7d"
      ? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      : input.range === "30d"
        ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        : null;

  try {
    const query = admin
      .from("admin_error_logs")
      .select("id,error_type,error_message,website_id,user_id,context,created_at")
      .order("created_at", { ascending: false })
      .limit(500);

    const { data, error } = threshold ? await query.gte("created_at", threshold) : await query;

    if (error) {
      throw new Error(error.message);
    }

    let rows = (data ?? []) as AdminErrorLogRecord[];
    if (input.type && input.type !== "all") {
      rows = rows.filter((row) => row.error_type === input.type);
    }

    const websitesById = await loadWebsitesByIds(
      Array.from(new Set(rows.map((row) => row.website_id).filter((value): value is string => Boolean(value))))
    );
    const usersById = await loadUsersByIds(
      Array.from(new Set(rows.map((row) => row.user_id).filter((value): value is string => Boolean(value))))
    );
    const { items, total, totalPages } = chunkPage(rows, page, pageSize);

    return {
      rows: items.map((row) => ({
        id: row.id,
        type: row.error_type,
        message: row.error_message,
        websiteUrl: websitesById.get(row.website_id ?? "")?.url ?? "—",
        userEmail: usersById.get(row.user_id ?? "")?.email ?? "—",
        createdAt: row.created_at,
        context: row.context ?? {}
      })),
      total,
      page,
      pageSize,
      totalPages,
      error: null
    };
  } catch (error) {
    return {
      rows: [],
      total: 0,
      page,
      pageSize,
      totalPages: 0,
      error: error instanceof Error ? error.message : "Unable to load admin errors."
    };
  }
}

function getAdminCronSuccessMessage(cronName: AdminCronName, data: Record<string, unknown>) {
  if (cronName === "process-scans") {
    const result = data.executed as
      | {
          processedCount?: number;
          queuedCount?: number;
          hasMore?: boolean;
        }
      | undefined;

    if (result) {
      const processedCount = result.processedCount ?? 0;
      const queuedCount = result.queuedCount ?? 0;

      return result.hasMore
        ? `process-scans ran ${processedCount} scan(s), queued ${queuedCount} job(s), and there is still backlog left for the next run.`
        : `process-scans ran ${processedCount} scan(s), queued ${queuedCount} job(s), and cleared the current due backlog.`;
    }
  }

  if (cronName === "process-reports") {
    const result = data.sent as
      | {
          processedCount?: number;
          queuedCount?: number;
          hasMore?: boolean;
        }
      | undefined;

    if (result) {
      const processedCount = result.processedCount ?? 0;
      const queuedCount = result.queuedCount ?? 0;

      return result.hasMore
        ? `process-reports sent ${processedCount} report(s), queued ${queuedCount} job(s), and there is still backlog left for the next run.`
        : `process-reports sent ${processedCount} report(s), queued ${queuedCount} job(s), and cleared the current due backlog.`;
    }
  }

  return `${cronName} triggered successfully.`;
}

export async function triggerAdminCron(cronName: AdminCronName) {
  try {
    const data = await executeAdminCron(cronName);

    return {
      ok: true,
      status: 200,
      cronName,
      payload: {
        data
      },
      message: getAdminCronSuccessMessage(cronName, data)
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to trigger cron.";

    return {
      ok: false,
      status: 500,
      cronName,
      payload: {
        error: message
      },
      message
    };
  }
}
