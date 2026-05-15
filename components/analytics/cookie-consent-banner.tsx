"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  type CookieConsentState,
  readCookieConsent,
  writeCookieConsent
} from "@/lib/cookie-consent";

export function CookieConsentBanner() {
  const [isReady, setIsReady] = useState(false);
  const [consent, setConsent] = useState<CookieConsentState | null>(null);

  useEffect(() => {
    setConsent(readCookieConsent());
    setIsReady(true);
  }, []);

  if (!isReady || consent) {
    return null;
  }

  const handleChoice = (value: CookieConsentState) => {
    writeCookieConsent(value);
    setConsent(value);
  };

  return (
    <div className="fixed inset-x-0 bottom-4 z-50 px-4 sm:px-6">
      <div
        aria-label="Cookie consent"
        className="mx-auto flex max-w-4xl flex-col gap-4 rounded-[1.75rem] border border-border bg-background/95 p-4 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.5)] backdrop-blur-xl sm:p-5"
        role="dialog"
      >
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
            Cookie preferences
          </p>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            SitePulse only loads Google Analytics after you accept. Essential storage for login,
            billing, and security stays enabled.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button onClick={() => handleChoice("declined")} type="button" variant="outline">
            Decline
          </Button>
          <Button onClick={() => handleChoice("accepted")} type="button">
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}
