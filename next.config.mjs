const browserTracingIncludes = [
  "node_modules/@sparticuz/chromium/**/*",
  "node_modules/@puppeteer/browsers/**/*",
  "node_modules/puppeteer-core/**/*",
  "node_modules/puppeteer/**/*"
];

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
      "/api/cron/process-report-pdfs": browserTracingIncludes,
      "/api/reports/generate": browserTracingIncludes,
      "/api/cron/process-scans": browserTracingIncludes,
      "/api/preview-scan": browserTracingIncludes,
      "/api/scan/run": browserTracingIncludes
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
