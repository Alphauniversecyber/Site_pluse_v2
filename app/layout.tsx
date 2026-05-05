import type { Metadata } from "next";
import localFont from "next/font/local";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

import "@/app/globals.css";

import { AnalyticsRoot } from "@/components/analytics/analytics-root";
import { Providers } from "@/components/providers";
import { themeScript } from "@/components/theme/theme-provider";

const manrope = localFont({
  src: "./fonts/manrope-latin-wght-normal.woff2",
  variable: "--font-manrope",
  display: "swap",
  weight: "200 800"
});

const spaceGrotesk = localFont({
  src: "./fonts/space-grotesk-latin-wght-normal.woff2",
  variable: "--font-space-grotesk",
  display: "swap",
  weight: "300 700"
});

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "SitePulse",
  url: "https://trysitepulse.com",
  description:
    "Automated SEO audits and white-label PDF reports for agencies. Share results with clients via magic-link dashboards. Try free for 14 days.",
  sameAs: [
    "https://www.facebook.com/profile.php?id=61589045769636",
    "https://www.linkedin.com/company/trysitepulse",
    "https://www.producthunt.com/products/sitepulse"
  ]
};

const softwareApplicationSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "SitePulse",
  url: "https://trysitepulse.com",
  description:
    "Automated SEO audits and white-label PDF reports for agencies. Share results with clients via magic-link dashboards. Try free for 14 days.",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  browserRequirements: "Requires JavaScript",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    description: "14-day free trial, no credit card required"
  },
  featureList: [
    "Automated SEO audits",
    "White-label PDF reports",
    "Google Search Console integration",
    "Google Analytics 4 integration",
    "Client-facing dashboard",
    "Revenue leak detection"
  ],
  screenshot: "https://trysitepulse.com/opengraph-image.png"
};

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "SitePulse",
  url: "https://trysitepulse.com",
  description:
    "Automated SEO audits and white-label PDF reports for agencies. Share results with clients via magic-link dashboards. Try free for 14 days.",
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: "https://trysitepulse.com/?q={search_term_string}"
    },
    "query-input": "required name=search_term_string"
  }
};

export const metadata: Metadata = {
  metadataBase: new URL("https://trysitepulse.com"),
  title: "SitePulse – SEO Audit Tool for Digital Agencies",
  description:
    "Automated SEO audits and white-label PDF reports for agencies. Share results with clients via magic-link dashboards. Try free for 14 days.",
  keywords: [
    "SEO audit SaaS",
    "SEO audit tool",
    "SEO audit software for agencies",
    "white-label SEO reports",
    "agency SEO reporting software",
    "website audit platform",
    "digital agency SEO tools",
    "client SEO dashboard",
    "Google Search Console reporting",
    "GA4 reporting for agencies"
  ],
  authors: [{ name: "SitePulse", url: "https://trysitepulse.com" }],
  creator: "SitePulse",
  publisher: "SitePulse",
  openGraph: {
    title: "SitePulse – SEO Audit Tool for Digital Agencies",
    description:
      "Automated SEO audits and white-label PDF reports for agencies. Share results with clients via magic-link dashboards. Try free for 14 days.",
    url: "https://trysitepulse.com",
    siteName: "SitePulse",
    type: "website",
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "SitePulse SEO Audit Tool for Digital Agencies"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "SitePulse – SEO Audit Tool for Digital Agencies",
    description:
      "Automated SEO audits and white-label PDF reports for agencies. Share results with clients via magic-link dashboards. Try free for 14 days.",
    images: ["/opengraph-image.png"],
    creator: "@trysitepulse"
  },
  robots: {
    index: true,
    follow: true
  },
  alternates: {
    canonical: "https://trysitepulse.com"
  },
  verification: {
    google: "PASTE_YOUR_GSC_VERIFICATION_CODE_HERE"
  },
  category: "technology"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationSchema) }}
        />
      </head>
      <body className={`${manrope.variable} ${spaceGrotesk.variable}`}>
        <Providers>
          {children}
          <AnalyticsRoot />
          <Analytics />
          <SpeedInsights />
        </Providers>
      </body>
    </html>
  );
}
