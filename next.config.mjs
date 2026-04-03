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
      "/api/cron/process-reports": ["./node_modules/@sparticuz/chromium/bin/**"],
      "/api/reports/[id]": ["./node_modules/@sparticuz/chromium/bin/**"],
      "/api/reports/generate": ["./node_modules/@sparticuz/chromium/bin/**"],
      "/api/reports/send": ["./node_modules/@sparticuz/chromium/bin/**"]
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
