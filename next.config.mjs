/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    typedRoutes: true,
    serverComponentsExternalPackages: [
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
      "/api/reports/generate": ["node_modules/@sparticuz/chromium/**/*"],
      "/api/cron/process-scans": ["node_modules/@sparticuz/chromium/**/*"],
      "/api/preview-scan": ["node_modules/@sparticuz/chromium/**/*"],
      "/api/scan/run": ["node_modules/@sparticuz/chromium/**/*"]
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
