"use client";

type AnalyticsEventProperties = Record<string, string | number | boolean | null | undefined>;

type AnalyticsUser = {
  id: string;
  email: string;
  fullName?: string | null;
  plan?: string | null;
};

export function initClientAnalytics() {
  return Promise.resolve();
}

export async function captureAnalyticsEvent(
  _event: string,
  _properties?: AnalyticsEventProperties
) {
  return;
}

export async function identifyAnalyticsUser(_user: AnalyticsUser) {
  return;
}

export async function clearAnalyticsUser() {
  return;
}

export async function registerAnalyticsRouteChange() {
  return;
}

export async function triggerPricingExitIntentSurvey() {
  return;
}

export async function triggerFirstScanNpsSurvey(_context?: AnalyticsEventProperties) {
  return;
}
