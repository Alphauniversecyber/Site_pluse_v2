"use client";

import type { CSSProperties, ReactNode } from "react";
import { useRouter } from "next/navigation";

import { TrialPaywall } from "@/components/trial/TrialPaywall";
import { useTrialPaywall } from "@/hooks/useTrialPaywall";
import { useUser } from "@/hooks/useUser";
import type { UserProfile } from "@/types";

type AddWebsiteButtonVariant = "primary" | "outline";

const baseButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  borderRadius: "14px",
  padding: "10px 16px",
  fontSize: "14px",
  fontWeight: 600,
  lineHeight: 1.2,
  cursor: "pointer",
  border: "1px solid transparent",
  transition: "all 0.2s ease",
  whiteSpace: "nowrap"
};

const variantStyles: Record<AddWebsiteButtonVariant, CSSProperties> = {
  primary: {
    background: "#2563EB",
    color: "white",
    boxShadow: "0 14px 32px -22px rgba(37, 99, 235, 0.9)"
  },
  outline: {
    background: "rgba(255,255,255,0.82)",
    color: "#0F172A",
    border: "1px solid rgba(148,163,184,0.4)",
    boxShadow: "0 12px 28px -24px rgba(15,23,42,0.35)"
  }
};

export function AddWebsiteButton({
  profile,
  websiteCount,
  children,
  variant = "primary",
  style
}: {
  profile?: UserProfile | null;
  websiteCount: number;
  children: ReactNode;
  variant?: AddWebsiteButtonVariant;
  style?: CSSProperties;
}) {
  const router = useRouter();
  const { user } = useUser({ enabled: !profile });
  const resolvedProfile = profile ?? user;
  const { paywallFeature, isExpired, closePaywall, requireAccess } = useTrialPaywall(resolvedProfile);

  return (
    <>
      <button
        type="button"
        onClick={() =>
          requireAccess(
            "add_website",
            () => router.push("/dashboard/websites/add"),
            { websiteCount }
          )
        }
        style={{
          ...baseButtonStyle,
          ...variantStyles[variant],
          ...style
        }}
      >
        {children}
      </button>
      <TrialPaywall
        isOpen={paywallFeature !== null}
        onClose={closePaywall}
        feature={paywallFeature ?? "add_website"}
        isExpired={isExpired}
      />
    </>
  );
}
