"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  COOKIE_CONSENT_EVENT,
  type CookieConsentState,
  readCookieConsent
} from "@/lib/cookie-consent";
import { createSupabaseBrowserClient } from "@/lib/supabase";

type AnalyticsIdentity = {
  id: string;
  email: string;
  firstName?: string | null;
  fullName?: string | null;
};

declare global {
  interface Window {
    Tawk_API?: {
      onLoad?: () => void;
      hideWidget?: () => void;
      showWidget?: () => void;
      setAttributes?: (
        attributes: Record<string, string>,
        callback?: (error?: string) => void
      ) => void;
      visitor?: {
        name?: string;
        email?: string;
      };
    };
    Tawk_LoadStart?: Date;
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const TAWK_PROPERTY_ID = process.env.NEXT_PUBLIC_TAWK_PROPERTY_ID;
const TAWK_WIDGET_ID = process.env.NEXT_PUBLIC_TAWK_WIDGET_ID;
const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? "G-2W3TL7PHMG";

function toAnalyticsIdentity(user: {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
} | null): AnalyticsIdentity | null {
  if (!user?.email) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    firstName:
      typeof user.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name.trim().split(/\s+/)[0]
        : null,
    fullName:
      typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : null
  };
}

export function AnalyticsRoot() {
  const pathname = usePathname();
  const [authUser, setAuthUser] = useState<AnalyticsIdentity | null>(null);
  const [cookieConsent, setCookieConsent] = useState<CookieConsentState | null>(null);
  const shouldHideTawk =
    pathname === "/" || pathname?.startsWith("/dashboard") || pathname?.startsWith("/d/") || pathname === "/d";
  const hasAnalyticsConsent = cookieConsent === "accepted";

  useEffect(() => {
    const syncCookieConsent = () => {
      setCookieConsent(readCookieConsent());
    };

    syncCookieConsent();
    window.addEventListener(COOKIE_CONSENT_EVENT, syncCookieConsent);
    window.addEventListener("storage", syncCookieConsent);

    return () => {
      window.removeEventListener(COOKIE_CONSENT_EVENT, syncCookieConsent);
      window.removeEventListener("storage", syncCookieConsent);
    };
  }, []);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let isMounted = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) {
        return;
      }

      setAuthUser(toAnalyticsIdentity(data.session?.user ?? null));
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) {
        return;
      }

      setAuthUser(toAnalyticsIdentity(session?.user ?? null));
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    let attempts = 0;
    const visitor = authUser
      ? {
          name: authUser.firstName || authUser.fullName || authUser.email,
          email: authUser.email
        }
      : null;

    const syncTawkState = () => {
      const tawkApi = window.Tawk_API;
      if (!tawkApi) {
        return false;
      }

      if (visitor) {
        tawkApi.visitor = visitor;
        try {
          tawkApi.setAttributes?.(
            {
              ...visitor,
              firstName: authUser?.firstName ?? ""
            },
            () => undefined
          );
        } catch {
          // Tawk secure attributes can be optional; visitor assignment is the safe fallback.
        }
      }

      if (shouldHideTawk) {
        tawkApi.hideWidget?.();
      } else {
        tawkApi.showWidget?.();
      }

      return true;
    };

    if (syncTawkState()) {
      return;
    }

    const interval = window.setInterval(() => {
      attempts += 1;
      if (syncTawkState() || attempts >= 20) {
        window.clearInterval(interval);
      }
    }, 400);

    return () => {
      window.clearInterval(interval);
    };
  }, [authUser, shouldHideTawk]);

  useEffect(() => {
    if (!hasAnalyticsConsent || typeof window === "undefined" || !window.gtag || !pathname) {
      return;
    }

    window.gtag("config", GA_MEASUREMENT_ID, {
      page_path: pathname
    });
  }, [hasAnalyticsConsent, pathname]);

  const tawkBootScript = useMemo(() => {
    const visitorScript = authUser?.email
      ? `window.Tawk_API.visitor=${JSON.stringify({
          name: authUser.firstName || authUser.fullName || authUser.email,
          email: authUser.email
        })};`
      : "";

    return `window.Tawk_API=window.Tawk_API||{};window.Tawk_LoadStart=new Date();${visitorScript}`;
  }, [authUser]);

  return (
    <>
      {hasAnalyticsConsent && GA_MEASUREMENT_ID ? (
        <>
          <Script
            id="sitepulse-google-tag-loader"
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
            strategy="afterInteractive"
          />
          <Script id="sitepulse-google-tag" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=window.gtag||gtag;gtag('js', new Date());gtag('config', '${GA_MEASUREMENT_ID}', { page_path: window.location.pathname });`}
          </Script>
        </>
      ) : null}
      {!shouldHideTawk && TAWK_PROPERTY_ID && TAWK_WIDGET_ID ? (
        <>
          <Script id="sitepulse-tawk-bootstrap" strategy="afterInteractive">
            {`${tawkBootScript}window.Tawk_API.customStyle={zIndex:40};`}
          </Script>
          <Script
            id="sitepulse-tawk"
            src={`https://embed.tawk.to/${TAWK_PROPERTY_ID}/${TAWK_WIDGET_ID}`}
            strategy="afterInteractive"
          />
        </>
      ) : null}
    </>
  );
}
