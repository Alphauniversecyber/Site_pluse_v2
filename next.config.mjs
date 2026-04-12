/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: [
    "@sparticuz/chromium",
    "puppeteer",
    "puppeteer-core",
    "linkinator",
    "metascraper",
    "metascraper-description",
    "metascraper-image",
    "metascraper-title",
    "metascraper-url",
    "re2",
    "url-regex-safe"
  ],
  experimental: {
    typedRoutes: true,
    outputFileTracingIncludes: {
      "/api/cron/process-reports": ["./node_modules/@sparticuz/chromium/**/*"],
      "/api/reports/[id]": ["./node_modules/@sparticuz/chromium/**/*"],
      "/api/reports/generate": ["./node_modules/@sparticuz/chromium/**/*"],
      "/api/reports/send": ["./node_modules/@sparticuz/chromium/**/*"]
    }
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co"
      }
    ]
  }
};

export default nextConfig;