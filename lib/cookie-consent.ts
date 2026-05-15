export const COOKIE_CONSENT_STORAGE_KEY = "sitepulse-cookie-consent";
export const COOKIE_CONSENT_EVENT = "sitepulse-cookie-consent-change";

export type CookieConsentState = "accepted" | "declined";

export function isCookieConsentState(value: unknown): value is CookieConsentState {
  return value === "accepted" || value === "declined";
}

export function readCookieConsent() {
  if (typeof window === "undefined") {
    return null;
  }

  const storedConsent = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);

  return isCookieConsentState(storedConsent) ? storedConsent : null;
}

export function writeCookieConsent(value: CookieConsentState) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, value);
  window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_EVENT));
}
