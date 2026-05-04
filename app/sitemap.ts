import type { MetadataRoute } from "next";

import { getAllBlogPosts } from "@/lib/blog-posts";
import { PUBLIC_SITE_URL } from "@/lib/seo";

const staticRoutes: Array<{
  path: string;
  changeFrequency: NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>;
  priority: number;
}> = [
  {
    path: "/",
    changeFrequency: "weekly",
    priority: 1
  },
  {
    path: "/pricing",
    changeFrequency: "weekly",
    priority: 0.95
  },
  {
    path: "/features",
    changeFrequency: "weekly",
    priority: 0.9
  },
  {
    path: "/about",
    changeFrequency: "monthly",
    priority: 0.7
  },
  {
    path: "/contact",
    changeFrequency: "monthly",
    priority: 0.7
  },
  {
    path: "/blog",
    changeFrequency: "weekly",
    priority: 0.85
  },
  {
    path: "/changelog",
    changeFrequency: "monthly",
    priority: 0.65
  },
  {
    path: "/roadmap",
    changeFrequency: "monthly",
    priority: 0.65
  },
  {
    path: "/privacy",
    changeFrequency: "yearly",
    priority: 0.4
  },
  {
    path: "/refund",
    changeFrequency: "yearly",
    priority: 0.4
  },
  {
    path: "/terms",
    changeFrequency: "yearly",
    priority: 0.4
  },
  {
    path: "/login",
    changeFrequency: "monthly",
    priority: 0.35
  },
  {
    path: "/signup",
    changeFrequency: "monthly",
    priority: 0.45
  },
  {
    path: "/reset-password",
    changeFrequency: "yearly",
    priority: 0.2
  }
];

export default function sitemap(): MetadataRoute.Sitemap {
  const posts = getAllBlogPosts();
  const now = new Date();
  const latestPostDate = posts[0]?.publishedAt ? new Date(posts[0].publishedAt) : now;

  const staticEntries: MetadataRoute.Sitemap = staticRoutes.map((route) => ({
    url: route.path === "/" ? PUBLIC_SITE_URL : `${PUBLIC_SITE_URL}${route.path}`,
    lastModified: route.path === "/blog" ? latestPostDate : now,
    changeFrequency: route.changeFrequency,
    priority: route.priority
  }));

  const blogEntries: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${PUBLIC_SITE_URL}/blog/${post.slug}`,
    lastModified: new Date(post.publishedAt),
    changeFrequency: "monthly",
    priority: 0.75
  }));

  return [...staticEntries, ...blogEntries];
}
