"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase";

type AnalyticsIdentity = {
  id: string;
  email: string;
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
    fullName:
      typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : null
  };
}

export function AnalyticsRoot() {
  const pathname = usePathname();
  const [authUser, setAuthUser] = useState<AnalyticsIdentity | null>(null);
  const shouldHideTawk = pathname?.startsWith("/dashboard") ?? false;

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
          name: authUser.fullName || authUser.email,
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
          tawkApi.setAttributes?.(visitor, () => undefined);
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
          name: authUser.fullName || authUser.email,
          email: authUser.email
        })};`
      : "";

    return `window.Tawk_API=window.Tawk_API||{};window.Tawk_LoadStart=new Date();${visitorScript}`;
  }, [authUser]);

  return (
    <>
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
