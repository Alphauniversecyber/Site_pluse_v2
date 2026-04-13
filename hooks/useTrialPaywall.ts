"use client";

import { useState } from "react";

import { canAccessFeature, isTrialExpired, type TrialFeature } from "@/lib/trial";
import type { UserProfile } from "@/types";

interface RequireAccessOptions {
  websiteCount?: number;
}

export function useTrialPaywall(profile: UserProfile | null | undefined) {
  const [paywallFeature, setPaywallFeature] = useState<TrialFeature | null>(null);

  function requireAccess(
    feature: TrialFeature,
    onAllowed: () => void,
    options: RequireAccessOptions = {}
  ) {
    if (!profile) {
      onAllowed();
      return;
    }

    if (canAccessFeature(profile, feature, options)) {
      onAllowed();
      return;
    }

    setPaywallFeature(feature);
  }

  return {
    paywallFeature,
    isExpired: profile ? isTrialExpired(profile) : false,
    closePaywall: () => setPaywallFeature(null),
    requireAccess
  };
}
