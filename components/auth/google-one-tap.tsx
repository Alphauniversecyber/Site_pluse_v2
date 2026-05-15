"use client";

import Script from "next/script";
import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { buildAppUserRecord, buildGoogleProfileRecord } from "@/lib/google-auth";
import { createSupabaseBrowserClient } from "@/lib/supabase";

declare global {
  interface Window {
    google?: {
      accounts?: {
        id: {
          initialize: (options: {
            client_id: string;
            callback: (response: GoogleCredentialResponse) => void;
            prompt_parent_id?: string;
            cancel_on_tap_outside?: boolean;
            auto_select?: boolean;
            context?: "signin" | "signup" | "use";
            itp_support?: boolean;
          }) => void;
          prompt: () => void;
          cancel: () => void;
        };
      };
    };
  }
}

type GoogleCredentialResponse = {
  credential?: string;
};

export function GoogleOneTap() {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() ?? "";
  const promptParentId = useId().replace(/:/g, "");
  const router = useRouter();
  const supabaseRef = useRef(createSupabaseBrowserClient());
  const isSigningInRef = useRef(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  useEffect(() => {
    if (!clientId) {
      setAuthChecked(true);
      return;
    }

    let active = true;
    const supabase = supabaseRef.current;

    async function loadAuthState() {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!active) {
        return;
      }

      setIsAuthenticated(Boolean(session));
      setAuthChecked(true);
    }

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) {
        return;
      }

      const isSignedIn = Boolean(session);
      setIsAuthenticated(isSignedIn);

      if (isSignedIn) {
        window.google?.accounts?.id.cancel();
      }
    });

    void loadAuthState();

    return () => {
      active = false;
      subscription.unsubscribe();
      window.google?.accounts?.id.cancel();
    };
  }, [clientId]);

  useEffect(() => {
    if (!clientId || !authChecked || isAuthenticated || !scriptLoaded) {
      return;
    }

    const googleAccounts = window.google?.accounts?.id;

    if (!googleAccounts) {
      return;
    }

    googleAccounts.initialize({
      client_id: clientId,
      prompt_parent_id: promptParentId,
      cancel_on_tap_outside: true,
      auto_select: false,
      context: "signin",
      itp_support: true,
      callback: async ({ credential }) => {
        if (!credential || isSigningInRef.current) {
          return;
        }

        isSigningInRef.current = true;

        try {
          const supabase = supabaseRef.current;
          const { error } = await supabase.auth.signInWithIdToken({
            provider: "google",
            token: credential
          });

          if (error) {
            throw error;
          }

          const {
            data: { user },
            error: userError
          } = await supabase.auth.getUser();

          if (userError || !user) {
            throw userError ?? new Error("Unable to load the authenticated user.");
          }

          const { id: userId, ...appUserRecord } = buildAppUserRecord(user);
          const { error: userProfileError } = await supabase
            .from("users")
            .update(appUserRecord)
            .eq("id", userId);

          if (userProfileError) {
            throw userProfileError;
          }

          const { error: profileError } = await supabase.from("profiles").upsert(
            buildGoogleProfileRecord(user),
            {
              onConflict: "user_id"
            }
          );

          if (profileError) {
            throw profileError;
          }

          window.google?.accounts?.id.cancel();
          window.location.href = "/dashboard";
        } catch (error) {
          const message = error instanceof Error ? error.message : "Google sign-in failed.";
          toast.error(message);
          isSigningInRef.current = false;
          router.refresh();
        }
      }
    });

    googleAccounts.prompt();

    return () => {
      googleAccounts.cancel();
    };
  }, [authChecked, clientId, isAuthenticated, promptParentId, router, scriptLoaded]);

  if (!clientId || !authChecked || isAuthenticated) {
    return null;
  }

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={() => setScriptLoaded(true)}
      />
      <div
        id={promptParentId}
        className="pointer-events-auto fixed right-4 top-4 z-[70] min-h-[1px] min-w-[1px]"
      />
    </>
  );
}
