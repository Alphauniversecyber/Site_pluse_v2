/*
create table if not exists churn_rescue_emails (
  user_id uuid not null references users(id) on delete cascade,
  sent_at timestamptz not null default now()
);

create index if not exists churn_rescue_emails_user_id_sent_at_idx
  on churn_rescue_emails (user_id, sent_at desc);
*/

import { runLoggedCron } from "@/lib/admin/logging";
import { buildEmailDedupeKey } from "@/lib/email-utils";
import { sendDay13Email, sendDay7Email } from "@/lib/lifecycle-email-service";
import { sendProductEmail } from "@/lib/resend";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getBaseUrl } from "@/lib/utils";
import type { UserProfile, Website } from "@/types";

export const runtime = "nodejs";

type TrialProfile = Pick<
  UserProfile,
  "id" | "email" | "full_name" | "created_at" | "trial_ends_at" | "is_trial" | "email_notifications_enabled"
>;

type PaidProfile = Pick<
  UserProfile,
  | "id"
  | "email"
  | "full_name"
  | "is_trial"
  | "subscription_status"
  | "paddle_subscription_id"
  | "email_notifications_enabled"
>;

type WebsiteScanRow = {
  website_id: string;
  scanned_at: string;
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;

function getDaysSince(timestamp: string) {
  return Math.floor((Date.now() - new Date(timestamp).getTime()) / DAY_IN_MS);
}

function isMissingRelationError(message: string | null | undefined) {
  return /does not exist|relation .* does not exist/i.test(message ?? "");
}

async function sendTrialMilestoneEmails(admin: ReturnType<typeof createSupabaseAdminClient>) {
  const recentTrialWindow = new Date(Date.now() - 16 * DAY_IN_MS).toISOString();
  const { data, error } = await admin
    .from("users")
    .select("id,email,full_name,created_at,trial_ends_at,is_trial,email_notifications_enabled")
    .eq("is_trial", true)
    .gte("created_at", recentTrialWindow);

  if (error) {
    throw new Error(error.message);
  }

  let sentCount = 0;

  for (const user of (data ?? []) as TrialProfile[]) {
    if (user.email_notifications_enabled === false) {
      continue;
    }

    const daysSinceCreated = getDaysSince(user.created_at);

    if (daysSinceCreated === 7) {
      await sendDay7Email(user);
      sentCount += 1;
      continue;
    }

    if (daysSinceCreated === 13) {
      await sendDay13Email(user);
      sentCount += 1;
    }
  }

  return sentCount;
}

async function loadRecentChurnRescueUserIds(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  userIds: string[]
) {
  if (!userIds.length) {
    return new Set<string>();
  }

  const windowStart = new Date(Date.now() - 30 * DAY_IN_MS).toISOString();
  const { data, error } = await admin
    .from("churn_rescue_emails")
    .select("user_id")
    .in("user_id", userIds)
    .gte("sent_at", windowStart);

  if (error) {
    if (isMissingRelationError(error.message)) {
      return new Set<string>();
    }

    throw new Error(error.message);
  }

  return new Set(((data ?? []) as Array<{ user_id: string }>).map((row) => row.user_id));
}

async function recordChurnRescueEmail(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  userId: string
) {
  const { error } = await admin.from("churn_rescue_emails").insert({
    user_id: userId,
    sent_at: new Date().toISOString()
  });

  if (error && !isMissingRelationError(error.message)) {
    throw new Error(error.message);
  }
}

async function sendChurnRescueEmails(admin: ReturnType<typeof createSupabaseAdminClient>) {
  const { data: users, error } = await admin
    .from("users")
    .select("id,email,full_name,is_trial,subscription_status,paddle_subscription_id,email_notifications_enabled")
    .eq("is_trial", false)
    .eq("subscription_status", "active")
    .not("paddle_subscription_id", "is", null);

  if (error) {
    throw new Error(error.message);
  }

  const paidUsers = ((users ?? []) as PaidProfile[]).filter(
    (user) => user.email_notifications_enabled !== false
  );

  if (!paidUsers.length) {
    return 0;
  }

  const userIds = paidUsers.map((user) => user.id);
  const [{ data: websitesData }, recentRescueUserIds] = await Promise.all([
    admin
      .from("websites")
      .select("id,user_id,label,url")
      .in("user_id", userIds),
    loadRecentChurnRescueUserIds(admin, userIds)
  ]);

  const websites = (websitesData ?? []) as Array<Pick<Website, "id" | "user_id" | "label" | "url">>;
  const websiteIds = websites.map((website) => website.id);

  if (!websiteIds.length) {
    return 0;
  }

  const { data: scanRows, error: scanError } = await admin
    .from("scan_results")
    .select("website_id,scanned_at")
    .in("website_id", websiteIds)
    .order("scanned_at", { ascending: false });

  if (scanError) {
    throw new Error(scanError.message);
  }

  const websiteOwnerMap = new Map(websites.map((website) => [website.id, website.user_id]));
  const latestScanByUser = new Map<string, string>();

  for (const row of (scanRows ?? []) as WebsiteScanRow[]) {
    const userId = websiteOwnerMap.get(row.website_id);

    if (!userId || latestScanByUser.has(userId)) {
      continue;
    }

    latestScanByUser.set(userId, row.scanned_at);
  }

  let sentCount = 0;

  for (const user of paidUsers) {
    if (recentRescueUserIds.has(user.id)) {
      continue;
    }

    const latestScannedAt = latestScanByUser.get(user.id);

    if (!latestScannedAt) {
      continue;
    }

    const scanAgeInDays = getDaysSince(latestScannedAt);
    if (scanAgeInDays <= 14) {
      continue;
    }

    await sendProductEmail({
      templateId: "churn_rescue",
      dedupeKey: buildEmailDedupeKey("lifecycle", "churn_rescue", user.id, latestScannedAt),
      campaign: "retention",
      to: user.email,
      subject: "Your sites haven't been scanned in 2 weeks",
      preheader: "SitePulse works best when it's running automatically. Set up scheduled scans in about 60 seconds.",
      eyebrow: "Churn rescue",
      title: "Your sites haven't been scanned in 2 weeks",
      summary: "SitePulse works best when it's running automatically. Here's how to set up scheduled scans in 60 seconds.",
      bodyHtml: `
        <p style="margin:0;font-size:15px;line-height:24px;color:#475569;">
          SitePulse works best when it's running automatically. Here's how to set up scheduled scans in 60 seconds.
        </p>
      `,
      ctaLabel: "Set up auto-scan",
      ctaUrl: `${getBaseUrl().replace(/\/$/, "")}/dashboard/websites`,
      metadata: {
        userId: user.id,
        latestScannedAt
      },
      triggeredAt: latestScannedAt
    });

    await recordChurnRescueEmail(admin, user.id);
    sentCount += 1;
  }

  return sentCount;
}

async function expireTrials(admin: ReturnType<typeof createSupabaseAdminClient>) {
  const { data, error } = await admin
    .from("users")
    .update({
      plan: "free",
      billing_cycle: null,
      subscription_price: null,
      subscription_status: "inactive",
      is_trial: false
    })
    .eq("is_trial", true)
    .lt("trial_ends_at", new Date().toISOString())
    .select("id");

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).length;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const admin = createSupabaseAdminClient();

  try {
    const result = await runLoggedCron("expire-trials", async () => {
      const trialEmailCount = await sendTrialMilestoneEmails(admin);
      const churnRescueCount = await sendChurnRescueEmails(admin);
      const expiredCount = await expireTrials(admin);

      return {
        processedCount: trialEmailCount + churnRescueCount + expiredCount,
        trialEmailCount,
        churnRescueCount,
        expiredCount
      };
    });

    return Response.json({ success: true, ...result });
  } catch (error) {
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : "Unable to expire trials."
    });
  }
}
