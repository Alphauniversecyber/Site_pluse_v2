export const ADMIN_COOKIE_NAME = "sp_admin_auth";
export const ADMIN_PAGE_SIZE = 20;
export const ADMIN_SUPABASE_EGRESS_THIS_MONTH = "6.48 / 5 GB";

export type AdminCronName =
  | "process-scans"
  | "process-reports"
  | "process-uptime"
  | "sync-uptimerobot"
  | "process-competitors"
  | "expire-trials"
  | "process-lifecycle-emails";

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
  }
> = {
  "process-scans": {
    label: "process-scans",
    path: "/api/cron/process-scans",
    schedule: "5 * * * *",
    description: "Runs due website scans."
  },
  "process-reports": {
    label: "process-reports",
    path: "/api/cron/process-reports",
    schedule: "25 * * * *",
    description: "Sends scheduled weekly reports."
  },
  "process-uptime": {
    label: "process-uptime",
    path: "/api/cron/process-uptime",
    schedule: "15 * * * *",
    description: "Checks website uptime and alerts."
  },
  "sync-uptimerobot": {
    label: "sync-uptimerobot",
    path: "/api/cron/sync-uptimerobot",
    schedule: "0 10 * * *",
    description: "Syncs UptimeRobot monitor results."
  },
  "process-competitors": {
    label: "process-competitors",
    path: "/api/cron/process-competitors",
    schedule: "35 * * * *",
    description: "Checks competitor score movement."
  },
  "expire-trials": {
    label: "expire-trials",
    path: "/api/cron/expire-trials",
    schedule: "0 2 * * *",
    description: "Moves expired trials back to the free plan."
  },
  "process-lifecycle-emails": {
    label: "process-lifecycle-emails",
    path: "/api/cron/process-lifecycle-emails",
    schedule: "0 12 * * *",
    description: "Sends welcome, trial, onboarding, and lifecycle emails."
  }
};

export const ADMIN_CRON_NAMES = Object.keys(ADMIN_CRON_DEFINITIONS) as AdminCronName[];
