import type { Metadata } from "next";

import { BlogIndexClient } from "@/components/blog/blog-index-client";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-json-ld";
import { BLOG_BASE_URL, getAllBlogPosts } from "@/lib/blog-posts";

export const metadata: Metadata = {
  title: {
    absolute: "Agency Growth Blog | SitePulse"
  },
  description:
    "Practical guides for agencies that want better audits, stronger reporting, and clients that stay.",
  alternates: {
    canonical: BLOG_BASE_URL
  },
  openGraph: {
    title: "Agency Growth Blog | SitePulse",
    description:
      "Practical guides for agencies that want better audits, stronger reporting, and clients that stay.",
    type: "website",
    url: BLOG_BASE_URL,
    images: [
      {
        url: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1600&q=80",
        alt: "SitePulse agency growth blog"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "Agency Growth Blog | SitePulse",
    description:
      "Practical guides for agencies that want better audits, stronger reporting, and clients that stay.",
    images: ["https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1600&q=80"]
  }
};

export default function BlogPage() {
  const posts = getAllBlogPosts();

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", item: "https://trysitepulse.com" },
          { name: "Blog", item: BLOG_BASE_URL }
        ]}
      />
      <BlogIndexClient posts={posts} />
    </>
  );
}
