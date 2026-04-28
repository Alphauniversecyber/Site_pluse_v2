import type { SubscriptionStatus, UserProfile } from "@/types";

export type TrialFeature =
  | "download_report"
  | "add_website"
  | "white_label"
  | "client_dashboard";

interface AccessOptions {
  websiteCount?: number;
}

const FREE_WEBSITE_LIMIT = 1;

type TrialWindowProfile = Pick<UserProfile, "trial_ends_at" | "is_trial">;
type PaidAccessProfile = Pick<UserProfile, "plan" | "subscription_status">;
type FeatureAccessProfile = TrialWindowProfile & PaidAccessProfile;
type ScheduledAutomationProfile = TrialWindowProfile & PaidAccessProfile;

export function getTrialDaysRemaining(profile: Pick<UserProfile, "trial_ends_at">): number {
  if (!profile.trial_ends_at) return 0;

  const now = new Date();
  const end = new Date(profile.trial_ends_at);
  const diff = end.getTime() - now.getTime();

  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export function isTrialActive(profile: TrialWindowProfile): boolean {
  if (!profile.is_trial) return false;
  if (!profile.trial_ends_at) return false;

  return new Date(profile.trial_ends_at) > new Date();
}

export function isTrialExpired(profile: TrialWindowProfile): boolean {
  if (!profile.is_trial) return false;
  if (!profile.trial_ends_at) return false;

  return new Date(profile.trial_ends_at) <= new Date();
}

function isPaidSubscriptionStatus(status: SubscriptionStatus | null) {
  return !["inactive", "cancelled", "suspended", "payment_denied"].includes(
    status ?? "active"
  );
}

export function hasActivePaidPlan(profile: PaidAccessProfile): boolean {
  return (
    isPaidSubscriptionStatus(profile.subscription_status) &&
    (profile.plan === "starter" || profile.plan === "agency")
  );
}

export function hasScheduledAutomationAccess(profile: ScheduledAutomationProfile): boolean {
  if (profile.plan === "free") {
    return false;
  }

  return hasActivePaidPlan(profile) || isTrialActive(profile);
}

export function canAccessFeature(
  profile: FeatureAccessProfile,
  feature: TrialFeature,
  options: AccessOptions = {}
): boolean {
  if (hasActivePaidPlan(profile)) return true;

  if (feature === "add_website") {
    const websiteCount = options.websiteCount ?? 0;

    if (isTrialActive(profile)) {
      return websiteCount < FREE_WEBSITE_LIMIT;
    }

    return websiteCount < FREE_WEBSITE_LIMIT;
  }

  if (isTrialActive(profile)) return true;

  return false;
}
