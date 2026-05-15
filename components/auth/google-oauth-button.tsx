"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase";

function GoogleIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24">
      <path
        d="M21.805 10.023H12.24v3.955h5.482c-.236 1.273-.955 2.352-2.027 3.078v2.559h3.287c1.924-1.771 3.034-4.378 3.034-7.486 0-.709-.064-1.392-.182-2.106Z"
        fill="#4285F4"
      />
      <path
        d="M12.24 22c2.737 0 5.032-.908 6.742-2.385l-3.287-2.559c-.908.611-2.07.972-3.455.972-2.648 0-4.894-1.787-5.696-4.191H3.153v2.639A10.18 10.18 0 0 0 12.24 22Z"
        fill="#34A853"
      />
      <path
        d="M6.544 13.837a6.118 6.118 0 0 1-.318-1.937c0-.672.114-1.327.318-1.936V7.325H3.153A10.18 10.18 0 0 0 2 11.9c0 1.646.395 3.204 1.153 4.575l3.391-2.638Z"
        fill="#FBBC05"
      />
      <path
        d="M12.24 5.773c1.489 0 2.825.512 3.877 1.516l2.91-2.91C17.268 2.739 14.973 1.8 12.24 1.8A10.18 10.18 0 0 0 3.153 7.325l3.391 2.639c.802-2.405 3.048-4.191 5.696-4.191Z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function GoogleOAuthButton() {
  const [submitting, setSubmitting] = useState(false);

  async function handleClick() {
    setSubmitting(true);

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    });

    if (error) {
      setSubmitting(false);
      toast.error(error.message);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full bg-background"
      disabled={submitting}
      aria-busy={submitting}
      onClick={() => void handleClick()}
    >
      <GoogleIcon />
      {submitting ? "Redirecting to Google..." : "Continue with Google"}
    </Button>
  );
}
