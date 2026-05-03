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

const softwareApplicationSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "SitePulse",
  url: "https://www.trysitepulse.com",
  description:
    "SEO audit and reporting tool for digital agencies. Generate white-label reports and turn audits into paying clients.",
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
  screenshot: "https://www.trysitepulse.com/opengraph-image.png"
};

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "SitePulse",
  url: "https://www.trysitepulse.com",
  logo: "https://www.trysitepulse.com/logo.png",
  sameAs: [
    "https://twitter.com/trysitepulse",
    "https://www.linkedin.com/company/trysitepulse",
    "https://www.producthunt.com/products/sitepulse"
  ]
};

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "SitePulse",
  url: "https://www.trysitepulse.com",
  description: "SEO audit and reporting tool for digital agencies",
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: "https://www.trysitepulse.com/?q={search_term_string}"
    },
    "query-input": "required name=search_term_string"
  }
};

export const metadata: Metadata = {
  metadataBase: new URL("https://www.trysitepulse.com"),
  title: {
    default: "SitePulse — SEO Audit & Reporting Tool for Agencies",
    template: "%s | SitePulse"
  },
  description:
    "Turn website audits into paying clients. Generate white-label client-ready SEO reports, uncover revenue leaks, and prove your value automatically. 14-day free trial.",
  keywords: [
    "SEO audit tool for agencies",
    "white label SEO reports",
    "automated SEO audit software",
    "agency SEO reporting tool",
    "client SEO reports generator",
    "website audit SaaS"
  ],
  authors: [{ name: "SitePulse", url: "https://www.trysitepulse.com" }],
  creator: "SitePulse",
  publisher: "SitePulse",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://www.trysitepulse.com",
    siteName: "SitePulse",
    title: "SitePulse — SEO Audit & Reporting Tool for Agencies",
    description:
      "Turn website audits into paying clients. White-label reports, revenue leak detection, automated audits.",
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "SitePulse SEO Audit Tool for Agencies"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "SitePulse — SEO Audit & Reporting Tool for Agencies",
    description: "Turn website audits into paying clients. 14-day free trial.",
    images: ["/opengraph-image.png"],
    creator: "@trysitepulse"
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1
    }
  },
  alternates: {
    canonical: "https://www.trysitepulse.com"
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
      </head>
      <body className={`${manrope.variable} ${spaceGrotesk.variable}`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
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
