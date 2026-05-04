"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

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
  const shouldHideTawk = pathname?.startsWith("/dashboard") || pathname?.startsWith("/d/") || pathname === "/d";

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
      {GA_MEASUREMENT_ID ? (
        <>
          <Script
            id="sitepulse-google-tag-loader"
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
            strategy="afterInteractive"
          />
          <Script id="sitepulse-google-tag" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=window.gtag||gtag;gtag('js', new Date());gtag('config', '${GA_MEASUREMENT_ID}');`}
          </Script>
        </>
      ) : null}
      {!shouldHideTawk && authUser?.firstName ? (
        <div className="pointer-events-none fixed bottom-24 right-20 z-30 hidden rounded-2xl border border-slate-200 bg-white/96 px-5 py-3 text-sm text-slate-800 shadow-[0_20px_45px_-25px_rgba(15,23,42,0.24)] sm:block dark:border-white/10 dark:bg-slate-950/90 dark:text-slate-100">
          {`Hi ${authUser.firstName}! How can we help?`}
        </div>
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
