import "server-only";

import type { UserProfile, Website } from "@/types";
import { logAdminError } from "@/lib/admin/logging";
import { logFailedTask } from "@/lib/failed-tasks";
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

type ActivationProfile = Pick<
  UserProfile,
  "id" | "email" | "full_name" | "created_at" | "is_trial" | "trial_ends_at"
>;

export type ActivationEmailType = "activation_day1" | "activation_day3" | "activation_day7";

type ActivationEmailDefinition = {
  emailType: ActivationEmailType;
  templateId: Parameters<typeof sendProductEmail>[0]["templateId"];
  targetDays: number;
  subject: string;
  preheader: string;
  eyebrow: string;
  title: string;
  summary: string;
  bodyHtml: string;
  ctaLabel: string;
  accent?: string;
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const HALF_DAY_IN_MS = 12 * 60 * 60 * 1000;
const ACTIVATION_DASHBOARD_URL = "https://trysitepulse.com/dashboard";
const ACTIVATION_EMAILS: ActivationEmailDefinition[] = [
  {
    emailType: "activation_day1",
    templateId: "activation_day_1",
    targetDays: 1,
    subject: "Your SitePulse account is ready \u2014 add your first site",
    preheader: "Your account is set up. Add your first site and make the most of the 14-day free trial.",
    eyebrow: "Activation day 1",
    title: "Your SitePulse account is ready",
    summary: "Your workspace is live and the 14-day free trial is already running.",
    bodyHtml: `
      <p style="margin:0 0 14px 0;font-size:15px;line-height:24px;color:#475569;">
        Everything is set up. The next step is simple: add your first site so SitePulse can start tracking performance and surfacing SEO issues.
      </p>
      <p style="margin:0;font-size:15px;line-height:24px;color:#475569;">
        Once your first site is in, you can start seeing where the biggest wins and risks are right away.
      </p>
    `,
    ctaLabel: "Add Your First Site"
  },
  {
    emailType: "activation_day3",
    templateId: "activation_day_3",
    targetDays: 3,
    subject: "Still haven't run your first audit?",
    preheader: "Run the first SitePulse audit and see the SEO issues, performance signals, and PDF report flow in action.",
    eyebrow: "Activation day 3",
    title: "Your first audit is still waiting",
    summary: "SitePulse gives you an instant SEO audit and a client-ready PDF report as soon as the first site is added.",
    bodyHtml: `
      <p style="margin:0 0 14px 0;font-size:15px;line-height:24px;color:#475569;">
        If you have not added a site yet, you have not seen the part that matters most: the audit itself. That is where SitePulse starts turning raw scan data into something easier to act on and easier to share.
      </p>
      <p style="margin:0;font-size:15px;line-height:24px;color:#475569;">
        Add a site, run the first audit, and you will immediately have a clearer picture of SEO issues plus a report you can use with clients.
      </p>
    `,
    ctaLabel: "Run Your First Audit"
  },
  {
    emailType: "activation_day7",
    templateId: "activation_day_7",
    targetDays: 7,
    subject: "Your trial is halfway gone \u2014 here's what you're missing",
    preheader: "Seven days are left in your trial. Add a site now to see what SitePulse can surface for you.",
    eyebrow: "Activation day 7",
    title: "You still have 7 days left to try SitePulse",
    summary: "Your trial is halfway through, but you have not used it yet because no site has been added.",
    bodyHtml: `
      <p style="margin:0 0 14px 0;font-size:15px;line-height:24px;color:#475569;">
        Adding one site is enough to see the core workflow: instant audit results, clear issue prioritization, and a polished PDF report you can put in front of a client.
      </p>
      <p style="margin:0;font-size:15px;line-height:24px;color:#475569;">
        If you have any questions or want help getting the first audit running, just reply to this email and we will help.
      </p>
    `,
    ctaLabel: "Add Your First Site",
    accent: "#C2410C"
  }
];

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

function getActivationWindow(targetDays: number) {
  const targetMs = Date.now() - targetDays * DAY_IN_MS;

  return {
    startIso: new Date(targetMs - HALF_DAY_IN_MS).toISOString(),
    endIso: new Date(targetMs + HALF_DAY_IN_MS).toISOString()
  };
}

function getActivationFailedTaskType(emailType: ActivationEmailType) {
  if (emailType === "activation_day1") {
    return "send-activation-day1" as const;
  }

  if (emailType === "activation_day3") {
    return "send-activation-day3" as const;
  }

  return "send-activation-day7" as const;
}

async function getAlreadySentLifecycleEmailUserIds(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  userIds: string[],
  emailType: ActivationEmailType
) {
  if (!userIds.length) {
    return new Set<string>();
  }

  const { data, error } = await admin
    .from("sent_lifecycle_emails")
    .select("user_id")
    .in("user_id", userIds)
    .eq("email_type", emailType);

  if (error) {
    throw new Error(error.message);
  }

  return new Set(((data ?? []) as Array<{ user_id: string }>).map((row) => row.user_id));
}

async function getActivationProfileById(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  userId: string
) {
  const { data, error } = await admin
    .from("users")
    .select("id,email,full_name,created_at,is_trial,trial_ends_at")
    .eq("id", userId)
    .maybeSingle<ActivationProfile>();

  if (error) {
    throw new Error(error.message);
  }

  return data ?? null;
}

async function getUserIdsWithWebsites(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  userIds: string[]
) {
  if (!userIds.length) {
    return new Set<string>();
  }

  const { data, error } = await admin
    .from("websites")
    .select("user_id")
    .in("user_id", userIds);

  if (error) {
    throw new Error(error.message);
  }

  return new Set(((data ?? []) as Array<{ user_id: string }>).map((row) => row.user_id));
}

async function markLifecycleEmailSent(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
  emailType: ActivationEmailType
) {
  const { error } = await admin.from("sent_lifecycle_emails").upsert(
    {
      user_id: userId,
      email_type: emailType,
      sent_at: new Date().toISOString()
    },
    {
      onConflict: "user_id,email_type",
      ignoreDuplicates: true
    }
  );

  if (error) {
    throw new Error(error.message);
  }
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

function buildActivationEmailPayload(
  profile: ActivationProfile,
  definition: ActivationEmailDefinition,
  dedupeKey: string
) {
  return {
    templateId: definition.templateId,
    dedupeKey,
    campaign: "lifecycle_activation",
    to: profile.email,
    subject: definition.subject,
    preheader: definition.preheader,
    eyebrow: definition.eyebrow,
    title: definition.title,
    summary: definition.summary,
    bodyHtml: definition.bodyHtml,
    ctaLabel: definition.ctaLabel,
    ctaUrl: ACTIVATION_DASHBOARD_URL,
    accent: definition.accent,
    metadata: {
      userId: profile.id,
      activationEmail: true,
      emailType: definition.emailType,
      targetDays: definition.targetDays,
      dedupeKey
    },
    triggeredAt: profile.created_at
  } as const;
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

async function sendActivationEmailBatch(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  definition: ActivationEmailDefinition,
  sentKeys: string[]
) {
  const { startIso, endIso } = getActivationWindow(definition.targetDays);
  const { data, error } = await admin
    .from("users")
    .select("id,email,full_name,created_at,is_trial,trial_ends_at")
    .gte("created_at", startIso)
    .lt("created_at", endIso)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const profiles = (data ?? []) as ActivationProfile[];

  if (!profiles.length) {
    console.info("[lifecycle:activation_window_empty]", {
      emailType: definition.emailType,
      targetDays: definition.targetDays,
      startIso,
      endIso
    });

    return {
      inspectedCount: 0,
      processedCount: 0
    };
  }

  const userIds = profiles.map((profile) => profile.id);
  const [alreadySentUserIds, userIdsWithWebsites] = await Promise.all([
    getAlreadySentLifecycleEmailUserIds(admin, userIds, definition.emailType),
    getUserIdsWithWebsites(admin, userIds)
  ]);

  const pendingProfiles = profiles.filter(
    (profile) => !alreadySentUserIds.has(profile.id) && !userIdsWithWebsites.has(profile.id)
  );

  console.info("[lifecycle:activation_candidates]", {
    emailType: definition.emailType,
    targetDays: definition.targetDays,
    windowStart: startIso,
    windowEnd: endIso,
    totalProfiles: profiles.length,
    alreadySentCount: alreadySentUserIds.size,
    hasWebsiteCount: userIdsWithWebsites.size,
    pendingCount: pendingProfiles.length
  });

  let processedCount = 0;

  for (const profile of pendingProfiles) {
    try {
      const result = await sendActivationEmailToProfile(admin, profile, definition);
      sentKeys.push(result.dedupeKey);
      processedCount += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to send activation email.";

      console.error("[lifecycle:activation_failed]", {
        emailType: definition.emailType,
        userId: profile.id,
        to: profile.email,
        error: message
      });

      await logAdminError({
        errorType: "email_failed",
        errorMessage: message,
        userId: profile.id,
        context: {
          lifecycleEmail: true,
          activationEmail: true,
          emailType: definition.emailType
        }
      });
      await logFailedTask({
        cronName: "process-lifecycle-emails",
        taskType: getActivationFailedTaskType(definition.emailType),
        userId: profile.id,
        errorMessage: message,
        payload: {
          userId: profile.id,
          emailType: definition.emailType
        }
      });
    }
  }

  return {
    inspectedCount: pendingProfiles.length,
    processedCount
  };
}

async function sendActivationEmailToProfile(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  profile: ActivationProfile,
  definition: ActivationEmailDefinition
) {
  const dedupeKey = buildEmailDedupeKey("lifecycle", definition.emailType, profile.id);
  const delivery = await sendProductEmail(buildActivationEmailPayload(profile, definition, dedupeKey));

  await markLifecycleEmailSent(admin, profile.id, definition.emailType);

  console.info("[lifecycle:activation_sent]", {
    emailType: definition.emailType,
    userId: profile.id,
    to: profile.email,
    dedupeKey,
    status: delivery ? "sent" : "deduped"
  });

  return {
    dedupeKey,
    delivery
  };
}

function getActivationEmailDefinition(emailType: ActivationEmailType) {
  const definition = ACTIVATION_EMAILS.find((item) => item.emailType === emailType);

  if (!definition) {
    throw new Error(`Unsupported activation email type: ${emailType}`);
  }

  return definition;
}

export async function retryActivationEmailTask(input: {
  userId: string;
  emailType: ActivationEmailType;
}) {
  const admin = createSupabaseAdminClient();
  const profile = await getActivationProfileById(admin, input.userId);

  if (!profile) {
    throw new Error("User profile not found.");
  }

  const definition = getActivationEmailDefinition(input.emailType);
  return sendActivationEmailToProfile(admin, profile, definition);
}

export async function sendActivationEmails() {
  const admin = createSupabaseAdminClient();
  const sentKeys: string[] = [];
  let inspectedCount = 0;
  let processedCount = 0;

  for (const definition of ACTIVATION_EMAILS) {
    const result = await sendActivationEmailBatch(admin, definition, sentKeys);
    inspectedCount += result.inspectedCount;
    processedCount += result.processedCount;
  }

  return {
    sentKeys,
    inspectedCount,
    processedCount
  };
}

export async function processLifecycleEmails(limit = getCronBatchLimit("LIFECYCLE_CRON_USER_LIMIT", 50)) {
  return processLifecycleEmailsBatch({
    limit,
    offset: 0
  });
}

export async function processLifecycleEmailsBatch(input: { limit?: number; offset?: number }) {
  const admin = createSupabaseAdminClient();
  const guard = createCronExecutionGuard("process-lifecycle-emails", 240_000);
  const limit = input.limit ?? getCronBatchLimit("LIFECYCLE_CRON_USER_LIMIT", 50);
  const offset = input.offset ?? 0;
  const recentSignupIso = new Date(Date.now() - 30 * DAY_IN_MS).toISOString();
  const { data: users, error } = await admin
    .from("users")
    .select("id,email,full_name,trial_ends_at,is_trial,created_at")
    .gte("created_at", recentSignupIso)
    .order("created_at", { ascending: false })
    .range(offset, offset + Math.max(limit - 1, 0));

  if (error) {
    throw new Error(error.message);
  }

  const sent: string[] = [];
  let inspectedCount = 0;

  for (const profile of (users ?? []) as LifecycleProfile[]) {
    if (guard.shouldStop({ sentCount: sent.length, userId: profile.id })) {
      break;
    }

    inspectedCount += 1;

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

  const rows = (users ?? []) as LifecycleProfile[];
  const hasMore = inspectedCount < rows.length || rows.length === limit;

  return {
    sentKeys: sent,
    processedCount: sent.length,
    inspectedCount,
    nextCursor: hasMore ? offset + inspectedCount : null,
    hasMore
  };
}
