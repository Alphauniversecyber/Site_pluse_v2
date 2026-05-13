const browserTracingIncludes = [
  "node_modules/@sparticuz/chromium/**/*",
  "node_modules/@puppeteer/browsers/**/*",
  "node_modules/puppeteer-core/**/*",
  "node_modules/puppeteer/**/*"
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: true,
  experimental: {
    typedRoutes: true,
    optimizePackageImports: ["lucide-react", "@radix-ui/react-icons"],
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
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com"
      }
    ]
  },
  async headers() {
    return [
      {
        source: "/llms.txt",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: "*"
          },
          {
            key: "X-Robots-Tag",
            value: "all"
          }
        ]
      },
      {
        source: "/robots.txt",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: "*"
          },
          {
            key: "X-Robots-Tag",
            value: "all"
          }
        ]
      },
      {
        source: "/sitemap.xml",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: "*"
          },
          {
            key: "X-Robots-Tag",
            value: "all"
          }
        ]
      },
      {
        source: "/d/:path*",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow, noarchive, nosnippet"
          }
        ]
      },
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1"
          }
        ]
      },
      {
        source: "/_next/static/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable"
          }
        ]
      }
    ];
  }
};

export default nextConfig; 
