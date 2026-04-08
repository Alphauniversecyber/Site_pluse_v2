import type { Metadata } from "next";

import { LegalPageShell } from "@/components/legal/legal-page-shell";

export const metadata: Metadata = {
  title: "Refund Policy",
  description: "SitePulse refund policy covering the 14-day free trial, automatic billing, and Paddle refund processing."
};

const lastUpdated = "April 8, 2026";

export default function RefundPage() {
  return (
    <LegalPageShell
      eyebrow="Legal"
      title="Refund Policy"
      intro="This Refund Policy explains how free trials, first charges, and refunds work for SitePulse subscriptions. All payments and refunds are processed through Paddle, which acts as Merchant of Record."
      lastUpdated={lastUpdated}
      sections={[
        {
          title: "1. Free Trial for Paid Plans",
          paragraphs: [
            "Growth and Pro include a 14-day free trial. You are not charged during the trial period.",
            "Starter remains free at $0 per month and $0 per year and does not require a refund process because there is no paid charge."
          ]
        },
        {
          title: "2. Automatic Billing After Trial",
          paragraphs: [
            "If you do not cancel before the 14-day free trial ends, your selected paid plan begins automatically and Paddle will bill you for the applicable monthly or yearly subscription price.",
            "Growth is billed at $49 per month or $470 per year. Pro is billed at $149 per month or $1,430 per year. Yearly plans provide approximately 20% savings compared with monthly pricing."
          ]
        },
        {
          title: "3. Refund Eligibility",
          paragraphs: [
            "Refund requests for the first paid subscription charge must be submitted within 14 days of that first payment date.",
            "No refunds are available for partial subscription periods, partial months, partial years, or unused time remaining in an active billing cycle."
          ]
        },
        {
          title: "4. How Refunds Are Processed",
          paragraphs: [
            "Approved refunds are processed through Paddle. Timing for the refund to appear in your account depends on Paddle and your payment method provider.",
            "Because Paddle is the Merchant of Record, payment handling, taxes, and refund processing are administered through Paddle's systems."
          ]
        },
        {
          title: "5. Cancellation and Future Charges",
          paragraphs: [
            "You can cancel your subscription at any time from your SitePulse billing settings. Cancellation stops future renewal charges.",
            "Cancelling a subscription does not automatically create a refund for charges already processed. Refund eligibility is determined under this policy."
          ]
        },
        {
          title: "6. Contact for Refund Requests",
          paragraphs: [
            "To request a refund, contact support@trysitepulse.com within 14 days of your first paid charge and include the email address associated with your account and the reason for the request.",
            "We may request additional details needed to locate the order in Paddle and review eligibility."
          ]
        }
      ]}
    />
  );
}
