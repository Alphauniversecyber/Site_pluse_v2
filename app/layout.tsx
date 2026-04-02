import type { Metadata } from "next";
import { Manrope, Space_Grotesk } from "next/font/google";

import "@/app/globals.css";

import { siteCopy } from "@/lib/copy";
import { Providers } from "@/components/providers";
import { themeScript } from "@/components/theme/theme-provider";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope"
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk"
});

export const metadata: Metadata = {
  title: {
    default: "SitePulse",
    template: "%s | SitePulse"
  },
  description: siteCopy.subTagline,
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
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
