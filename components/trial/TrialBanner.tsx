"use client";

import { useRouter } from "next/navigation";

import { getTrialDaysRemaining, hasActivePaidPlan, isTrialActive, isTrialExpired } from "@/lib/trial";
import type { UserProfile } from "@/types";

export function TrialBanner({ profile }: { profile: UserProfile }) {
  const router = useRouter();

  if (hasActivePaidPlan(profile)) return null;
  if (!profile.is_trial) return null;

  const daysRemaining = getTrialDaysRemaining(profile);
  const expired = isTrialExpired(profile);

  if (expired) {
    return (
      <div
        style={{
          background: "#FEE2E2",
          borderBottom: "1px solid #FECACA",
          padding: "10px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          flexWrap: "wrap"
        }}
      >
        <span style={{ color: "#991B1B", fontSize: "14px", fontWeight: 500 }}>
          Your free trial has ended. Upgrade to keep using SitePulse premium features.
        </span>
        <button
          type="button"
          onClick={() => router.push("/dashboard/billing")}
          style={{
            background: "#DC2626",
            color: "white",
            border: "none",
            borderRadius: "6px",
            padding: "6px 16px",
            fontSize: "13px",
            fontWeight: 600,
            cursor: "pointer"
          }}
        >
          Upgrade Now
        </button>
      </div>
    );
  }

  if (!isTrialActive(profile)) return null;

  const urgency = daysRemaining <= 3 ? "#DC2626" : daysRemaining <= 7 ? "#D97706" : "#2563EB";
  const background = daysRemaining <= 3 ? "#FEE2E2" : daysRemaining <= 7 ? "#FFFBEB" : "#EFF6FF";
  const border = daysRemaining <= 3 ? "#FECACA" : daysRemaining <= 7 ? "#FDE68A" : "#BFDBFE";

  return (
    <div
      style={{
        background,
        borderBottom: `1px solid ${border}`,
        padding: "10px 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
        flexWrap: "wrap"
      }}
      >
      <span style={{ color: urgency, fontSize: "14px", fontWeight: 500 }}>
        Trial ends in {daysRemaining} day{daysRemaining !== 1 ? "s" : ""}.
        {daysRemaining <= 7 ? " Don't lose premium access." : ""}
      </span>
      <button
        type="button"
        onClick={() => router.push("/dashboard/billing")}
        style={{
          background: urgency,
          color: "white",
          border: "none",
          borderRadius: "6px",
          padding: "6px 16px",
          fontSize: "13px",
          fontWeight: 600,
          cursor: "pointer"
        }}
      >
        Upgrade Now
      </button>
    </div>
  );
}
