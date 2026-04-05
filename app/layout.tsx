import type { Metadata } from "next";
import localFont from "next/font/local";

import "@/app/globals.css";

import { AnalyticsRoot } from "@/components/analytics/analytics-root";
import { marketingCopy } from "@/lib/marketing-copy";
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

export const metadata: Metadata = {
  title: {
    default: "SitePulse",
    template: "%s | SitePulse"
  },
  description: marketingCopy.subTagline,
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  icons: {
    icon: "/icon.svg"
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${manrope.variable} ${spaceGrotesk.variable}`}>
        <Providers>
          {children}
          <AnalyticsRoot />
        </Providers>
      </body>
    </html>
  );
}
