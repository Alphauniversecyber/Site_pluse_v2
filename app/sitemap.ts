import { MetadataRoute } from "next";

import { getAllBlogPosts } from "@/lib/blog-posts";

export default function sitemap(): MetadataRoute.Sitemap {
  const posts = getAllBlogPosts();

  return [
    {
      url: "https://www.trysitepulse.com",
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1
    },
    {
      url: "https://www.trysitepulse.com/pricing",
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8
    },
    {
      url: "https://www.trysitepulse.com/features",
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8
    },
    {
      url: "https://www.trysitepulse.com/login",
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6
    },
    {
      url: "https://www.trysitepulse.com/signup",
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6
    },
    {
      url: "https://www.trysitepulse.com/reset-password",
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6
    },
    {
      url: "https://www.trysitepulse.com/contact",
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6
    },
    {
      url: "https://www.trysitepulse.com/blog",
      lastModified: new Date(posts[0]?.publishedAt ?? Date.now()),
      changeFrequency: "monthly",
      priority: 0.7
    },
    {
      url: "https://www.trysitepulse.com/changelog",
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6
    },
    {
      url: "https://www.trysitepulse.com/roadmap",
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6
    },
    {
      url: "https://www.trysitepulse.com/privacy",
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.6
    },
    {
      url: "https://www.trysitepulse.com/refund",
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.6
    },
    {
      url: "https://www.trysitepulse.com/terms",
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.6
    },
    ...posts.map((post) => ({
      url: `https://www.trysitepulse.com/blog/${post.slug}`,
      lastModified: new Date(post.publishedAt),
      changeFrequency: "monthly" as const,
      priority: 0.65
    }))
  ];
}
