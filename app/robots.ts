import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: [
        "/reports/",
        "/report/",
        "/api/reports/",
        "/api/cron/",
        "/api/webhooks/",
        "/dashboard/",
        "/admin/",
        "/auth/",
        "/d/",
        "/unlock-preview/"
      ]
    },
    sitemap: "https://www.trysitepulse.com/sitemap.xml"
  };
}
