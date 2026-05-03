import type { Metadata } from "next";

import { LegalPageShell } from "@/components/legal/legal-page-shell";

export const metadata: Metadata = {
  title: "SitePulse Privacy Policy",
  description:
    "Read the SitePulse Privacy Policy to understand how we collect, use, store, and protect customer data across our SEO audit platform.",
  alternates: {
    canonical: "https://www.trysitepulse.com/privacy"
  }
};

const lastUpdated = "April 8, 2026";

export default function PrivacyPage() {
  return (
    <LegalPageShell
      eyebrow="Legal"
      title="SitePulse Privacy Policy"
      intro="This Privacy Policy explains what personal data SitePulse collects, how we use it, how it is stored, and what rights you have in relation to your information."
      lastUpdated={lastUpdated}
      sections={[
        {
          title: "1. Information We Collect",
          paragraphs: [
            "We collect information you provide directly when you create an account, use the platform, configure websites, or contact us. We also collect limited technical and usage information generated when you use the service."
          ],
          bullets: [
            "Name and account profile details.",
            "Email address used to create and access your SitePulse account.",
            "Website URLs and labels that you add for scanning and reporting.",
            "Usage data such as actions taken in the dashboard, report generation activity, scan activity, and service interaction logs.",
            "Billing information required to manage subscriptions and payments, which is processed through Paddle."
          ]
        },
        {
          title: "2. How We Use Personal Data",
          bullets: [
            "To provide the SitePulse service, including account access, website scans, monitoring, alerts, and reports.",
            "To improve the platform, diagnose issues, monitor reliability, and develop new or improved features.",
            "To communicate with users about service updates, account notices, billing events, support, legal changes, and relevant product information.",
            "To process payments, manage subscriptions, and handle billing-related support through Paddle."
          ]
        },
        {
          title: "3. Data Storage and Security",
          paragraphs: [
            "We store account data, scan data, reporting data, and related service records on infrastructure used to operate SitePulse. We use reasonable administrative, technical, and organizational safeguards designed to protect personal data against unauthorized access, loss, misuse, and alteration.",
            "No internet-based system is completely secure. While we work to protect personal data, we cannot guarantee absolute security."
          ]
        },
        {
          title: "4. Cookies and Similar Technologies",
          paragraphs: [
            "SitePulse uses cookies and similar technologies to maintain sessions, remember settings, improve user experience, measure usage, and support core security and authentication functions.",
            "You can control cookies through your browser settings, but disabling essential cookies may affect how the service functions."
          ]
        },
        {
          title: "5. Third-Party Services",
          paragraphs: [
            "We rely on third-party service providers to operate SitePulse efficiently. These providers may process limited personal data on our behalf or in their own role as independent service providers."
          ],
          bullets: [
            "Paddle, which processes payments, billing, taxes, and refunds as Merchant of Record.",
            "Analytics services used to understand product usage and improve the platform.",
            "Hosting and infrastructure providers used to run SitePulse and store service data securely."
          ]
        },
        {
          title: "6. User Rights",
          paragraphs: [
            "You may request access to, correction of, or deletion of your personal data, subject to legal and operational requirements. You may also request deletion of your account and associated service data.",
            "For privacy requests, contact privacy@trysitepulse.com. We may need to verify your identity before completing a request."
          ]
        },
        {
          title: "7. Data Retention",
          paragraphs: [
            "We retain personal data for as long as needed to provide the service, comply with legal obligations, resolve disputes, enforce agreements, and maintain legitimate business records. Some billing or compliance records may be retained for longer periods where required by law or by Paddle's obligations as Merchant of Record."
          ]
        },
        {
          title: "8. International Processing",
          paragraphs: [
            "Your information may be processed or stored in jurisdictions other than your own, depending on where our service providers and infrastructure operate. Where required, we use reasonable safeguards to protect data transferred across borders."
          ]
        },
        {
          title: "9. Changes to This Policy",
          paragraphs: [
            "We may update this Privacy Policy from time to time. If we make material changes, we may notify you through the service or by email. Your continued use of SitePulse after the revised policy takes effect means you accept the updated policy."
          ]
        }
      ]}
    />
  );
}
