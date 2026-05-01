export const ADMIN_COOKIE_NAME = "sp_admin_auth";
export const ADMIN_PAGE_SIZE = 20;
export const ADMIN_SUPABASE_EGRESS_THIS_MONTH = "6.48 / 5 GB";

export type AdminCronName =
  | "process-scans"
  | "retry-failed-scans"
  | "process-report-pdfs"
  | "process-report-emails"
  | "process-uptime"
  | "sync-uptimerobot"
  | "process-competitors"
  | "expire-trials"
  | "process-lifecycle-emails"
  | "process-paddle-webhooks";

export const ADMIN_SIDEBAR_LINKS = [
  { href: "/admin", label: "Overview", icon: "📊" },
  { href: "/admin/users", label: "Users", icon: "👥" },
  { href: "/admin/websites", label: "Websites", icon: "🌐" },
  { href: "/admin/reports", label: "Reports", icon: "📄" },
  { href: "/admin/crons", label: "Crons", icon: "⚙️" },
  { href: "/admin/emails", label: "Emails", icon: "📧" },
  { href: "/admin/billing", label: "Billing", icon: "💳" },
  { href: "/admin/errors", label: "Errors", icon: "🚨" }
] as const;

export const ADMIN_CRON_DEFINITIONS: Record<
  AdminCronName,
  {
    label: string;
    path: string;
  schedule: string;
  description: string;
  queueBacked?: boolean;
  hidden?: boolean;
  }
> = {
  "process-scans": {
    label: "process-scans",
    path: "/api/cron/process-scans",
    schedule: "0 6 * * *",
    description:
      "Daily GitHub Actions job for due website scans. This cron enqueues work and the worker drains the queue separately, so scan completion is tracked in Scan Monitoring above.",
    queueBacked: true
  },
  "retry-failed-scans": {
    label: "retry-failed-scans",
    path: "/api/cron/retry-failed-scans",
    schedule: "1 6 * * *",
    description:
      "Runs right after process-scans in a separate scheduler window. GitHub Actions concurrency keeps it behind the main scan cron so failed latest scans are retried after the primary run.",
    queueBacked: true
  },
  "process-report-pdfs": {
    label: "process-report-pdfs",
    path: "/api/cron/process-report-pdfs",
    schedule: "0 10 * * *",
    description:
      "Daily GitHub Actions job for scheduled report PDF generation. It queues websites that are due for a scheduled report, then the worker generates or refreshes the PDF.",
    queueBacked: true
  },
  "process-report-emails": {
    label: "process-report-emails",
    path: "/api/cron/process-report-emails",
    schedule: "0 11 * * *",
    description:
      "Daily GitHub Actions job for scheduled report email delivery. It only sends emails for reports that already have a generated PDF.",
    queueBacked: true
  },
  "process-uptime": {
    label: "process-uptime",
    path: "/api/cron/process-uptime",
    schedule: "0 7 * * *",
    description: "Daily GitHub Actions job for uptime checks. This cron enqueues work and the worker drains the queue separately.",
    queueBacked: true
  },
  "sync-uptimerobot": {
    label: "sync-uptimerobot",
    path: "/api/cron/sync-uptimerobot",
    schedule: "0 8 * * *",
    description: "Daily GitHub Actions job for syncing UptimeRobot monitors."
  },
  "process-competitors": {
    label: "process-competitors",
    path: "/api/cron/process-competitors",
    schedule: "0 9 * * *",
    description: "Checks competitor score movement through the queue worker.",
    queueBacked: true
  },
  "expire-trials": {
    label: "expire-trials",
    path: "/api/cron/expire-trials",
    schedule: "0 12 * * *",
    description: "Moves expired trials back to the free plan."
  },
  "process-lifecycle-emails": {
    label: "process-lifecycle-emails",
    path: "/api/cron/process-lifecycle-emails",
    schedule: "0 13 * * *",
    description: "Sends welcome, trial, onboarding, and lifecycle emails."
  },
  "process-paddle-webhooks": {
    label: "process-paddle-webhooks",
    path: "/api/cron/process-paddle-webhooks",
    schedule: "0 5 * * *",
    description: "Daily GitHub Actions job for queued Paddle webhooks, alongside immediate kicks from the live webhook endpoint."
  }
};

export const ADMIN_CRON_NAMES = (Object.entries(ADMIN_CRON_DEFINITIONS)
  .filter(([, definition]) => !definition.hidden)
  .map(([key]) => key)) as AdminCronName[];
