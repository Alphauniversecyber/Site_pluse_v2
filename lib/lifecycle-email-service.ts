import "server-only";

import type { UserProfile, Website } from "@/types";
import { logAdminError } from "@/lib/admin/logging";
import { createCronExecutionGuard, getCronBatchLimit } from "@/lib/cron";
import { buildEmailDedupeKey } from "@/lib/email-utils";
import { sendProductEmail } from "@/lib/resend";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getBaseUrl } from "@/lib/utils";

type LifecycleProfile = Pick<
  UserProfile,
  "id" | "email" | "full_name" | "trial_ends_at" | "is_trial" | "created_at"
>;

type LifecycleSnapshot = {
  websites: Array<Pick<Website, "id" | "label" | "gsc_connected_at">>;
  websiteCount: number;
  successfulScanCount: number;
  hasGscConnection: boolean;
  firstWebsiteId: string | null;
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;

function getDaysSince(timestamp: string) {
  return Math.floor((Date.now() - new Date(timestamp).getTime()) / DAY_IN_MS);
}

function getTrialDaysRemaining(trialEndsAt: string | null) {
  if (!trialEndsAt) {
    return 0;
  }

  return Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / DAY_IN_MS);
}

function getDashboardUrl(path: string) {
  return `${getBaseUrl().replace(/\/$/, "")}${path}`;
}

async function loadLifecycleSnapshot(userId: string): Promise<LifecycleSnapshot> {
  const admin = createSupabaseAdminClient();
  const { data: websites } = await admin
    .from("websites")
    .select("id,label,gsc_connected_at")
    .eq("user_id", userId);

  const typedWebsites = ((websites ?? []) as Array<Pick<Website, "id" | "label" | "gsc_connected_at">>);
  const websiteIds = typedWebsites.map((website) => website.id);
  const successfulScanCount = websiteIds.length
    ? (
        await admin
          .from("scan_results")
          .select("id", { count: "exact", head: true })
          .in("website_id", websiteIds)
          .eq("scan_status", "success")
      ).count ?? 0
    : 0;

  return {
    websites: typedWebsites,
    websiteCount: typedWebsites.length,
    successfulScanCount,
    hasGscConnection: typedWebsites.some((website) => Boolean(website.gsc_connected_at)),
    firstWebsiteId: typedWebsites[0]?.id ?? null
  };
}

async function queueEmail(
  sent: string[],
  dedupeKey: string,
  action: ReturnType<typeof sendProductEmail>
) {
  const delivery = await action;
  if (delivery) {
    sent.push(dedupeKey);
  }
}

async function maybeSendWelcomeEmails(profile: LifecycleProfile, snapshot: LifecycleSnapshot, sent: string[]) {
  if (getDaysSince(profile.created_at) > 7) {
    return;
  }

  const welcomeKey = buildEmailDedupeKey("lifecycle", "welcome", profile.id);
  await queueEmail(
    sent,
    welcomeKey,
    sendProductEmail({
      templateId: "welcome",
      dedupeKey: welcomeKey,
      campaign: "lifecycle",
      to: profile.email,
      subject: "Welcome to SitePulse",
      preheader: "Your SitePulse workspace is ready. Add the first website and start building a baseline.",
      eyebrow: "Welcome",
      title: `Welcome to SitePulse, ${profile.full_name?.split(" ")[0] ?? "there"}`,
      summary: "Your workspace is ready for the first website, first scan, and the kind of reporting flow that is easy to carry into client conversations.",
      bodyHtml: `
        <p style="margin:0 0 14px 0;font-size:15px;line-height:24px;color:#475569;">
          Start by adding the first website. Once the first scan lands, SitePulse can turn raw monitoring data into a cleaner retention and reporting workflow.
        </p>
        <p style="margin:0;font-size:15px;line-height:24px;color:#475569;">
          The goal is simple: make it easier to spot risk early, package wins clearly, and stay proactive with clients.
        </p>
      `,
      ctaLabel: "Add your first website",
      ctaUrl: getDashboardUrl("/dashboard/websites/add"),
      secondaryLabel: "Open dashboard",
      secondaryUrl: getDashboardUrl("/dashboard"),
      details: [
        {
          label: "Websites",
          value: String(snapshot.websiteCount)
        },
        {
          label: "Successful scans",
          value: String(snapshot.successfulScanCount)
        }
      ],
      metadata: {
        userId: profile.id
      },
      triggeredAt: profile.created_at
    })
  );

  if (!profile.is_trial || !profile.trial_ends_at) {
    return;
  }

  // Disabled to stay within daily send limits.
  // const trialStartedKey = buildEmailDedupeKey("lifecycle", "trial_started", profile.id, profile.trial_ends_at);
  // await queueEmail(
  //   sent,
  //   trialStartedKey,
  //   sendProductEmail({
  //     templateId: "trial_started",
  //     dedupeKey: trialStartedKey,
  //     campaign: "lifecycle",
  //     to: profile.email,
  //     subject: "Your 14-day SitePulse trial has started",
  //     preheader: "Your trial is live. Add a site, run a scan, and start building client-ready proof.",
  //     eyebrow: "Trial started",
  //     title: "Your 14-day trial is live",
  //     summary: "You now have a live window to test scans, reports, alerts, and the client workflow before deciding whether to keep it running long term.",
  //     bodyHtml: `
  //       <p style="margin:0 0 14px 0;font-size:15px;line-height:24px;color:#475569;">
  //         The best next step is to add a client website and run the first scan. That gives SitePulse enough real data to start showing score changes, issues, and reporting value.
  //       </p>
  //       <p style="margin:0;font-size:15px;line-height:24px;color:#475569;">
  //         If the workflow helps you protect one client relationship or package one improvement clearly, the trial has already done its job.
  //       </p>
  //     `,
  //     ctaLabel: "Start the first scan",
  //     ctaUrl: getDashboardUrl("/dashboard/websites/add"),
  //     secondaryLabel: "See billing",
  //     secondaryUrl: getDashboardUrl("/dashboard/billing"),
  //     details: [
  //       {
  //         label: "Trial ends",
  //         value: new Date(profile.trial_ends_at).toLocaleDateString("en-US", {
  //           month: "short",
  //           day: "numeric",
  //           year: "numeric"
  //         })
  //       },
  //       {
  //         label: "Days left",
  //         value: String(Math.max(getTrialDaysRemaining(profile.trial_ends_at), 0))
  //       }
  //     ],
  //     metadata: {
  //       userId: profile.id,
  //       trialEndsAt: profile.trial_ends_at
  //     },
  //     triggeredAt: profile.created_at
  //   })
  // );
}

async function maybeSendTrialReminderEmails(profile: LifecycleProfile, sent: string[]) {
  if (!profile.is_trial || !profile.trial_ends_at) {
    return;
  }

  const daysRemaining = getTrialDaysRemaining(profile.trial_ends_at);

  if (daysRemaining === 7) {
    // Disabled to stay within daily send limits.
    // const dedupeKey = buildEmailDedupeKey("lifecycle", "trial_reminder_7d", profile.id, profile.trial_ends_at);
    // await queueEmail(
    //   sent,
    //   dedupeKey,
    //   sendProductEmail({
    //     templateId: "trial_reminder_7d",
    //     dedupeKey,
    //     campaign: "lifecycle",
    //     to: profile.email,
    //     subject: "7 days left on your SitePulse trial",
    //     preheader: "A week is left on your trial. Keep the data moving and decide if you want to keep the workflow active.",
    //     eyebrow: "Trial reminder",
    //     title: "7 days left on your trial",
    //     summary: "You still have enough time to run a few meaningful scans, package the strongest findings, and decide whether the workflow earns a permanent place in your stack.",
    //     bodyHtml: `
    //       <p style="margin:0 0 14px 0;font-size:15px;line-height:24px;color:#475569;">
    //         Focus on one or two websites that matter most. The clearest signal usually comes from seeing the score history, issue list, and report flow on a real client account.
    //       </p>
    //       <p style="margin:0;font-size:15px;line-height:24px;color:#475569;">
    //         If you already have scans in place, this is a good time to open billing and decide whether you want to keep the workflow uninterrupted.
    //       </p>
    //     `,
    //     ctaLabel: "Review billing",
    //     ctaUrl: getDashboardUrl("/dashboard/billing"),
    //     secondaryLabel: "Open dashboard",
    //     secondaryUrl: getDashboardUrl("/dashboard"),
    //     details: [
    //       {
    //         label: "Days left",
    //         value: "7"
    //       }
    //     ],
    //     metadata: {
    //       userId: profile.id,
    //       trialEndsAt: profile.trial_ends_at
    //     },
    //     triggeredAt: profile.trial_ends_at
    //   })
    // );
  }

  if (daysRemaining === 2) {
    // Disabled to stay within daily send limits.
    // const dedupeKey = buildEmailDedupeKey("lifecycle", "trial_reminder_2d", profile.id, profile.trial_ends_at);
    // await queueEmail(
    //   sent,
    //   dedupeKey,
    //   sendProductEmail({
    //     templateId: "trial_reminder_2d",
    //     dedupeKey,
    //     campaign: "lifecycle",
    //     to: profile.email,
    //     subject: "2 days left on your SitePulse trial",
    //     preheader: "Only 2 days remain. Upgrade now if you want to keep dashboards, reports, and monitoring flowing.",
    //     eyebrow: "Trial reminder",
    //     title: "2 days left before the trial ends",
    //     summary: "The trial window is almost over, so this is the moment to decide whether you want to keep the data, reports, and client workflow uninterrupted.",
    //     bodyHtml: `
    //       <p style="margin:0 0 14px 0;font-size:15px;line-height:24px;color:#475569;">
    //         If the workflow is already helping you track client risk, package improvements, or keep reports cleaner, upgrading now avoids any unnecessary pause.
    //       </p>
    //       <p style="margin:0;font-size:15px;line-height:24px;color:#475569;">
    //         Waiting until after expiry increases the chance that follow-up work turns reactive instead of staying proactive.
    //       </p>
    //     `,
    //     ctaLabel: "Upgrade now",
    //     ctaUrl: getDashboardUrl("/dashboard/billing"),
    //     secondaryLabel: "Open dashboard",
    //     secondaryUrl: getDashboardUrl("/dashboard"),
    //     details: [
    //       {
    //         label: "Days left",
    //         value: "2"
    //       }
    //     ],
    //     accent: "#C2410C",
    //     metadata: {
    //       userId: profile.id,
    //       trialEndsAt: profile.trial_ends_at
    //     },
    //     triggeredAt: profile.trial_ends_at
    //   })
    // );
  }

  if (daysRemaining <= 0 && getDaysSince(profile.created_at) <= 30) {
    // Disabled to stay within daily send limits.
    // const dedupeKey = buildEmailDedupeKey("lifecycle", "trial_expired", profile.id, profile.trial_ends_at);
    // await queueEmail(
    //   sent,
    //   dedupeKey,
    //   sendProductEmail({
    //     templateId: "trial_expired",
    //     dedupeKey,
    //     campaign: "lifecycle",
    //     to: profile.email,
    //     subject: "Your SitePulse trial has ended",
    //     preheader: "The trial has ended. Upgrade if you want to continue reports, dashboards, and ongoing monitoring.",
    //     eyebrow: "Trial ended",
    //     title: "Your trial has ended",
    //     summary: "The trial window has now closed, so SitePulse will fall back to the limited free experience until you choose a paid plan.",
    //     bodyHtml: `
    //       <p style="margin:0 0 14px 0;font-size:15px;line-height:24px;color:#475569;">
    //         Upgrade when you are ready to keep scheduled reports, broader monitoring coverage, and the client workflow active without interruption.
    //       </p>
    //       <p style="margin:0;font-size:15px;line-height:24px;color:#475569;">
    //         If you still need the workflow, the cleanest next step is to reopen billing and activate the plan that matches your current client load.
    //       </p>
    //     `,
    //     ctaLabel: "Choose a plan",
    //     ctaUrl: getDashboardUrl("/dashboard/billing"),
    //     secondaryLabel: "Open dashboard",
    //     secondaryUrl: getDashboardUrl("/dashboard"),
    //     accent: "#B91C1C",
    //     metadata: {
    //       userId: profile.id,
    //       trialEndsAt: profile.trial_ends_at
    //     },
    //     triggeredAt: profile.trial_ends_at
    //   })
    // );
  }
}

async function maybeSendOnboardingEmails(profile: LifecycleProfile, snapshot: LifecycleSnapshot, sent: string[]) {
  const daysSinceCreated = getDaysSince(profile.created_at);
  const firstWebsitePath = snapshot.firstWebsiteId
    ? `/dashboard/websites/${snapshot.firstWebsiteId}`
    : "/dashboard/websites/add";

  if (daysSinceCreated === 1 && snapshot.successfulScanCount > 0) {
    // Disabled to stay within daily send limits.
    // const dedupeKey = buildEmailDedupeKey("onboarding", "day_1", profile.id);
    // await queueEmail(
    //   sent,
    //   dedupeKey,
    //   sendProductEmail({
    //     templateId: "onboarding_day_1",
    //     dedupeKey,
    //     campaign: "onboarding",
    //     to: profile.email,
    //     subject: "How to read your first SitePulse report",
    //     preheader: "You already have scan data. Here is the fastest way to turn it into clear next steps.",
    //     eyebrow: "Onboarding day 1",
    //     title: "How to read the first report faster",
    //     summary: "The first report is easiest to use when you read it in order: score change, highest-priority issues, then the quick wins that are easiest to explain or ship.",
    //     bodyHtml: `
    //       <p style="margin:0 0 14px 0;font-size:15px;line-height:24px;color:#475569;">
    //         Start with the overall score and major movement, then check the highest-priority findings before you spend time on smaller cleanup items.
    //       </p>
    //       <p style="margin:0;font-size:15px;line-height:24px;color:#475569;">
    //         That sequence makes it much easier to turn technical output into a short client-ready narrative instead of a long list of scattered tasks.
    //       </p>
    //     `,
    //     ctaLabel: "Open your reports",
    //     ctaUrl: getDashboardUrl("/dashboard/reports"),
    //     secondaryLabel: "Review website",
    //     secondaryUrl: getDashboardUrl(firstWebsitePath),
    //     details: [
    //       {
    //         label: "Successful scans",
    //         value: String(snapshot.successfulScanCount)
    //       }
    //     ],
    //     metadata: {
    //       userId: profile.id
    //     },
    //     triggeredAt: profile.created_at
    //   })
    // );
  }

  if (daysSinceCreated === 3 && snapshot.websiteCount > 0) {
    // Disabled to stay within daily send limits.
    // const dedupeKey = buildEmailDedupeKey("onboarding", "day_3", profile.id);
    // await queueEmail(
    //   sent,
    //   dedupeKey,
    //   sendProductEmail({
    //     templateId: "onboarding_day_3",
    //     dedupeKey,
    //     campaign: "onboarding",
    //     to: profile.email,
    //     subject: "Did you know you can send polished client reports from SitePulse?",
    //     preheader: "Use the report flow to package scans into cleaner client-facing follow-up.",
    //     eyebrow: "Onboarding day 3",
    //     title: "Turn scans into client-ready follow-up",
    //     summary: "The report flow is where SitePulse becomes easier to sell internally and externally, because the data stops looking like raw diagnostics and starts looking like a clean status update.",
    //     bodyHtml: `
    //       <p style="margin:0 0 14px 0;font-size:15px;line-height:24px;color:#475569;">
    //         Generate a report after the strongest scan, review the biggest findings, and use the dashboard link when you want clients or stakeholders to keep exploring live data.
    //       </p>
    //       <p style="margin:0;font-size:15px;line-height:24px;color:#475569;">
    //         Even if you do not send every report immediately, keeping them ready makes follow-up conversations much easier to move forward.
    //       </p>
    //     `,
    //     ctaLabel: "Open reports",
    //     ctaUrl: getDashboardUrl("/dashboard/reports"),
    //     secondaryLabel: "Review websites",
    //     secondaryUrl: getDashboardUrl("/dashboard/websites"),
    //     details: [
    //       {
    //         label: "Websites",
    //         value: String(snapshot.websiteCount)
    //       }
    //     ],
    //     metadata: {
    //       userId: profile.id
    //     },
    //     triggeredAt: profile.created_at
    //   })
    // );
  }

  if (daysSinceCreated === 5 && snapshot.websiteCount > 0 && !snapshot.hasGscConnection) {
    // Disabled to stay within daily send limits.
    // const dedupeKey = buildEmailDedupeKey("onboarding", "day_5", profile.id);
    // await queueEmail(
    //   sent,
    //   dedupeKey,
    //   sendProductEmail({
    //     templateId: "onboarding_day_5",
    //     dedupeKey,
    //     campaign: "onboarding",
    //     to: profile.email,
    //     subject: "Connect Google Search Console for live client data",
    //     preheader: "Bring in live search visibility data so the dashboard has more context than Lighthouse scores alone.",
    //     eyebrow: "Onboarding day 5",
    //     title: "Connect Search Console for richer client context",
    //     summary: "Search Console adds the live visibility layer that makes SitePulse much easier to use in ongoing client reporting, especially when performance and traffic questions start overlapping.",
    //     bodyHtml: `
    //       <p style="margin:0 0 14px 0;font-size:15px;line-height:24px;color:#475569;">
    //         Once Search Console is connected, SitePulse can pair technical scan findings with real search visibility data, which makes follow-up conversations feel more grounded.
    //       </p>
    //       <p style="margin:0;font-size:15px;line-height:24px;color:#475569;">
    //         That extra context is especially helpful when you need to explain why an issue matters beyond the raw score alone.
    //       </p>
    //     `,
    //     ctaLabel: "Open the website workspace",
    //     ctaUrl: getDashboardUrl(firstWebsitePath),
    //     secondaryLabel: "Open settings",
    //     secondaryUrl: getDashboardUrl("/dashboard/settings"),
    //     metadata: {
    //       userId: profile.id
    //     },
    //     triggeredAt: profile.created_at
    //   })
    // );
  }

  if (daysSinceCreated === 7 && (snapshot.websiteCount > 0 || snapshot.successfulScanCount > 0)) {
    // Disabled to stay within daily send limits.
    // const dedupeKey = buildEmailDedupeKey("onboarding", "day_7", profile.id);
    // await queueEmail(
    //   sent,
    //   dedupeKey,
    //   sendProductEmail({
    //     templateId: "onboarding_day_7",
    //     dedupeKey,
    //     campaign: "onboarding",
    //     to: profile.email,
    //     subject: "Your first week in SitePulse",
    //     preheader: "A quick summary of what you have in motion after the first week.",
    //     eyebrow: "Onboarding day 7",
    //     title: "Your first week is in motion",
    //     summary: "After the first week, the main question is whether you already have enough activity to turn SitePulse into a repeatable part of your client workflow.",
    //     bodyHtml: `
    //       <p style="margin:0 0 14px 0;font-size:15px;line-height:24px;color:#475569;">
    //         If you already have websites, scans, or reports in the workspace, you are past setup and into real usage. The next improvement usually comes from tightening the follow-up rhythm, not adding more tools.
    //       </p>
    //       <p style="margin:0;font-size:15px;line-height:24px;color:#475569;">
    //         Use the dashboard to review what is active, where the biggest open issues sit, and which websites are ready for the next report cycle.
    //       </p>
    //     `,
    //     ctaLabel: "Open the dashboard",
    //     ctaUrl: getDashboardUrl("/dashboard"),
    //     secondaryLabel: "Open websites",
    //     secondaryUrl: getDashboardUrl("/dashboard/websites"),
    //     details: [
    //       {
    //         label: "Websites",
    //         value: String(snapshot.websiteCount)
    //       },
    //       {
    //         label: "Successful scans",
    //         value: String(snapshot.successfulScanCount)
    //       }
    //     ],
    //     metadata: {
    //       userId: profile.id
    //     },
    //     triggeredAt: profile.created_at
    //   })
    // );
  }
}

export async function processLifecycleEmails(limit = getCronBatchLimit("LIFECYCLE_CRON_USER_LIMIT", 50)) {
  const admin = createSupabaseAdminClient();
  const guard = createCronExecutionGuard("process-lifecycle-emails", 240_000);
  const recentSignupIso = new Date(Date.now() - 30 * DAY_IN_MS).toISOString();
  const { data: users, error } = await admin
    .from("users")
    .select("id,email,full_name,trial_ends_at,is_trial,created_at")
    .gte("created_at", recentSignupIso)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  const sent: string[] = [];

  for (const profile of (users ?? []) as LifecycleProfile[]) {
    if (guard.shouldStop({ sentCount: sent.length, userId: profile.id })) {
      break;
    }

    try {
      const snapshot = await loadLifecycleSnapshot(profile.id);
      await maybeSendWelcomeEmails(profile, snapshot, sent);
      await maybeSendTrialReminderEmails(profile, sent);
      await maybeSendOnboardingEmails(profile, snapshot, sent);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to process lifecycle email.";
      await logAdminError({
        errorType: "email_failed",
        errorMessage: message,
        userId: profile.id,
        context: {
          lifecycleEmail: true
        }
      });
    }
  }

  return sent;
}
