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
  outputFileTracingIncludes: {
    "/api/cron/process-reports": ["node_modules/@sparticuz/chromium/**/*"],
    "/api/reports/generate": ["node_modules/@sparticuz/chromium/**/*"]
  },
  experimental: {
    typedRoutes: true
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
