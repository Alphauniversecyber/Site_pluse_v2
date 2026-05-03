import type { Metadata } from "next";

import { LegalPageShell } from "@/components/legal/legal-page-shell";

export const metadata: Metadata = {
  title: "SitePulse Terms of Service",
  description:
    "Read the SitePulse Terms of Service covering subscriptions, billing, acceptable use, reporting workflows, and payment processing.",
  alternates: {
    canonical: "https://www.trysitepulse.com/terms"
  }
};

const lastUpdated = "April 8, 2026";

export default function TermsPage() {
  return (
    <LegalPageShell
      eyebrow="Legal"
      title="SitePulse Terms of Service"
      intro="These Terms of Service govern your use of SitePulse, a SaaS platform that helps agencies scan websites, monitor website health, generate client-ready reports, and manage recurring proof of value for their clients."
      lastUpdated={lastUpdated}
      sections={[
        {
          title: "1. Service Description",
          paragraphs: [
            "SitePulse provides website performance, SEO, accessibility, trust, uptime, and reporting workflows for agencies and service businesses. The platform includes website scans, score tracking, white-label reporting, alerting, and related account management tools.",
            "SitePulse is offered as a subscription service. Features, limits, and reporting depth may vary by plan."
          ]
        },
        {
          title: "2. User Accounts and Responsibilities",
          paragraphs: [
            "You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account. You must provide accurate account and billing information and keep it current.",
            "You are responsible for ensuring that you have the right to scan, monitor, and report on any website you add to the platform. You must not use SitePulse to access systems or data that you are not authorized to review."
          ]
        },
        {
          title: "3. Subscription Plans and Billing",
          paragraphs: [
            "SitePulse offers the following plans: Starter at $0 per month and $0 per year, Growth at $49 per month or $470 per year, and Pro at $149 per month or $1,430 per year. Yearly plans provide approximately 20% savings compared with monthly pricing.",
            "Paid plans include a 14-day free trial. You will not be charged during the trial. Unless you cancel before the trial ends, your paid subscription will begin automatically at the selected monthly or yearly rate."
          ],
          bullets: [
            "Starter: $0 per month or $0 per year.",
            "Growth: $49 per month or $470 per year after the 14-day free trial.",
            "Pro: $149 per month or $1,430 per year after the 14-day free trial."
          ]
        },
        {
          title: "4. Automatic Renewal and Cancellation",
          paragraphs: [
            "Paid subscriptions renew automatically at the end of each billing cycle unless cancelled before renewal. Monthly plans renew every month. Yearly plans renew every year.",
            "You may cancel your subscription at any time from your billing settings. Cancellation stops future renewals. Access to paid features continues through the end of the current paid period unless otherwise stated."
          ]
        },
        {
          title: "5. Payments and Merchant of Record",
          paragraphs: [
            "All payments, billing operations, tax collection, and refunds for SitePulse are processed by Paddle, which acts as the Merchant of Record. By purchasing a paid plan, you also agree to Paddle's buyer terms and payment processing requirements.",
            "SitePulse does not directly process card details. Billing information required for payment handling is processed through Paddle."
          ]
        },
        {
          title: "6. Acceptable Use Policy",
          bullets: [
            "You must not use SitePulse to perform unlawful, harmful, fraudulent, or unauthorized activity.",
            "You must not attempt to disrupt, overload, reverse engineer, or interfere with the platform or its supporting infrastructure.",
            "You must not upload malicious content, exploit security issues, or use the service to target third-party systems without authorization.",
            "You must not resell, sublicense, or misuse SitePulse data or reports in a way that violates applicable law or the rights of others."
          ]
        },
        {
          title: "7. Intellectual Property",
          paragraphs: [
            "SitePulse, including its software, design, branding, content structure, and generated report templates, is owned by SitePulse and its licensors and is protected by applicable intellectual property laws.",
            "You retain ownership of your own account data, website lists, branding assets, and content you provide to the service. You grant SitePulse the limited rights necessary to host, process, and display that content in order to provide the service."
          ]
        },
        {
          title: "8. Limitation of Liability",
          paragraphs: [
            "SitePulse is provided on an \"as is\" and \"as available\" basis. To the maximum extent permitted by law, SitePulse disclaims all implied warranties, including merchantability, fitness for a particular purpose, and non-infringement.",
            "To the maximum extent permitted by law, SitePulse will not be liable for any indirect, incidental, special, consequential, exemplary, or punitive damages, or for any loss of profits, revenue, data, goodwill, or business interruption arising from or relating to your use of the service.",
            "SitePulse's total liability for any claim relating to the service will not exceed the amount you paid to SitePulse through Paddle during the 12 months preceding the event giving rise to the claim."
          ]
        },
        {
          title: "9. Governing Law",
          paragraphs: [
            "These Terms of Service are governed by the laws of Sri Lanka, without regard to conflict of law principles.",
            "Any dispute arising out of or relating to these Terms or the use of SitePulse will be subject to the exclusive jurisdiction of the courts of Sri Lanka, unless applicable law requires otherwise."
          ]
        },
        {
          title: "10. Updates to These Terms",
          paragraphs: [
            "We may update these Terms of Service from time to time. If we make material changes, we may provide notice through the platform or by email. Continued use of SitePulse after updated terms become effective constitutes acceptance of the revised terms."
          ]
        }
      ]}
    />
  );
}
