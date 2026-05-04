import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "Googlebot",
        allow: "/",
        disallow: ["/dashboard", "/api", "/admin", "/auth"]
      },
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard", "/api", "/admin", "/auth"]
      }
    ],
    sitemap: "https://trysitepulse.com/sitemap.xml"
  };
}
