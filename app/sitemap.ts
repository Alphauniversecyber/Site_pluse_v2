import { existsSync } from "node:fs";
import path from "node:path";
import type { MetadataRoute } from "next";

const baseUrl = "https://www.trysitepulse.com";

const staticRoutes: Array<{
  route: string;
  priority: number;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
}> = [
  { route: "/", priority: 1, changeFrequency: "weekly" },
  { route: "/features", priority: 0.8, changeFrequency: "weekly" },
  { route: "/pricing", priority: 0.8, changeFrequency: "weekly" },
  { route: "/login", priority: 0.6, changeFrequency: "monthly" },
  { route: "/signup", priority: 0.6, changeFrequency: "monthly" },
  { route: "/reset-password", priority: 0.6, changeFrequency: "monthly" },
  { route: "/contact", priority: 0.6, changeFrequency: "monthly" },
  { route: "/changelog", priority: 0.6, changeFrequency: "monthly" },
  { route: "/roadmap", priority: 0.6, changeFrequency: "monthly" },
  { route: "/privacy", priority: 0.6, changeFrequency: "yearly" },
  { route: "/refund", priority: 0.6, changeFrequency: "yearly" },
  { route: "/terms", priority: 0.6, changeFrequency: "yearly" }
];

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [...staticRoutes];

  if (existsSync(path.join(process.cwd(), "app", "(public)", "blog", "page.tsx"))) {
    routes.splice(3, 0, {
      route: "/blog",
      priority: 0.6,
      changeFrequency: "weekly"
    });
  }

  return routes.map(({ route, priority, changeFrequency }) => ({
    url: `${baseUrl}${route === "/" ? "" : route}`,
    lastModified: new Date(),
    changeFrequency,
    priority
  }));
}
