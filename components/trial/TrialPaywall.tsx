"use client";

import { useRouter } from "next/navigation";

import type { TrialFeature } from "@/lib/trial";

interface TrialPaywallProps {
  isOpen: boolean;
  onClose: () => void;
  feature: TrialFeature;
  isExpired: boolean;
}

const FEATURE_COPY: Record<
  TrialFeature,
  {
    title: string;
    benefit: string;
    activeDescription: string;
    expiredDescription: string;
  }
> = {
  download_report: {
    title: "Upgrade to Keep Using Reports",
    benefit: "Unlimited branded PDF reports",
    activeDescription:
      "PDF report creation is part of SitePulse paid plans. Upgrade to keep generating polished client-ready reports.",
    expiredDescription:
      "Your free trial has ended. Upgrade to keep generating and downloading professional PDF reports."
  },
  add_website: {
    title: "Upgrade to Add More Sites",
    benefit: "Monitor more websites from one dashboard",
    activeDescription:
      "Your current access includes one website. Upgrade to add more sites and manage more client accounts from one place.",
    expiredDescription:
      "Your free trial has ended. Upgrade to keep adding and monitoring more websites."
  },
  white_label: {
    title: "Upgrade for White-Label Branding",
    benefit: "Your brand on every client report",
    activeDescription:
      "White-label branding is part of the paid experience. Upgrade to add your logo, colors, and sender details.",
    expiredDescription:
      "Your free trial has ended. Upgrade to keep using white-label branding in client reports."
  },
  client_dashboard: {
    title: "Upgrade for Client Dashboards",
    benefit: "Live dashboards your clients can open anytime",
    activeDescription:
      "Live client dashboards are available on paid plans. Upgrade to keep sharing them with clients.",
    expiredDescription:
      "Your free trial has ended. Upgrade to keep sharing live client dashboards."
  }
};

export function TrialPaywall({
  isOpen,
  onClose,
  feature,
  isExpired
}: TrialPaywallProps) {
  const router = useRouter();
  const copy = FEATURE_COPY[feature];

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.6)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px"
      }}
    >
      <div
        style={{
          background: "white",
          borderRadius: "16px",
          padding: "32px",
          maxWidth: "440px",
          width: "100%",
          textAlign: "center",
          boxShadow: "0 25px 50px rgba(0,0,0,0.25)"
        }}
      >
        <div style={{ fontSize: "42px", marginBottom: "16px" }}>Locked</div>

        <h2
          style={{
            fontSize: "22px",
            fontWeight: 700,
            color: "#0F172A",
            margin: "0 0 12px"
          }}
        >
          {copy.title}
        </h2>

        <p
          style={{
            fontSize: "15px",
            color: "#64748B",
            margin: "0 0 20px",
            lineHeight: 1.6
          }}
        >
          {isExpired ? copy.expiredDescription : copy.activeDescription}
        </p>

        <div
          style={{
            background: "#F0FDF4",
            border: "1px solid #BBF7D0",
            borderRadius: "8px",
            padding: "12px 16px",
            marginBottom: "24px",
            fontSize: "14px",
            color: "#166534",
            fontWeight: 500
          }}
        >
          {copy.benefit}
        </div>

        <button
          type="button"
          onClick={() => router.push("/dashboard/billing")}
          style={{
            width: "100%",
            background: "#2563EB",
            color: "white",
            border: "none",
            borderRadius: "10px",
            padding: "14px",
            fontSize: "16px",
            fontWeight: 700,
            cursor: "pointer",
            marginBottom: "12px"
          }}
        >
          Upgrade Now
        </button>

        <button
          type="button"
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: "#94A3B8",
            fontSize: "13px",
            cursor: "pointer"
          }}
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}
