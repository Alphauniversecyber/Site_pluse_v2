const browserTracingIncludes = [
  "node_modules/@sparticuz/chromium/**/*",
  "node_modules/@puppeteer/browsers/**/*",
  "node_modules/puppeteer-core/**/*",
  "node_modules/puppeteer/**/*"
];
const isProduction = process.env.NODE_ENV === "production";

function toOrigin(url) {
  if (!url) {
    return null;
  }

  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

function buildContentSecurityPolicy() {
  const supabaseOrigin = toOrigin(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const directives = [
    "default-src 'self'",
    [
      "script-src",
      "'self'",
      "'unsafe-inline'",
      !isProduction ? "'unsafe-eval'" : null,
      "https://www.googletagmanager.com",
      "https://cdn.paddle.com",
      "https://embed.tawk.to",
      "https://va.vercel-scripts.com"
    ]
      .filter(Boolean)
      .join(" "),
    [
      "connect-src",
      "'self'",
      supabaseOrigin,
      "https://*.supabase.co",
      "wss://*.supabase.co",
      "https://www.googletagmanager.com",
      "https://www.google-analytics.com",
      "https://region1.google-analytics.com",
      "https://stats.g.doubleclick.net",
      "https://*.paddle.com",
      "https://*.tawk.to",
      "wss://*.tawk.to",
      "https://vitals.vercel-insights.com",
      "https://va.vercel-scripts.com"
    ]
      .filter(Boolean)
      .join(" "),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self' https://checkout.paddle.com https://sandbox-checkout.paddle.com",
    "frame-src 'self' https://*.paddle.com https://*.tawk.to",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    isProduction ? "upgrade-insecure-requests" : null
  ];

  return directives.filter(Boolean).join("; ");
}

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: buildContentSecurityPolicy()
  },
  {
    key: "X-Frame-Options",
    value: "DENY"
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload"
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff"
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin"
  },
  {
    key: "Permissions-Policy",
    value:
      "accelerometer=(), autoplay=(), browsing-topics=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), picture-in-picture=(), usb=()"
  }
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
          ...securityHeaders,
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
          ...securityHeaders,
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
          ...securityHeaders,
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
          ...securityHeaders,
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow, noarchive, nosnippet"
          }
        ]
      },
      {
        source: "/(.*)",
        headers: [
          ...securityHeaders,
          {
            key: "X-Robots-Tag",
            value: "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1"
          }
        ]
      },
      {
        source: "/_next/static/(.*)",
        headers: [
          ...securityHeaders,
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable"
          }
        ]
      }
    ];
  }
};

// DNSSEC must be enabled manually in the Cloudflare DNS dashboard. It cannot be enforced from Next.js code.

export default nextConfig; 
