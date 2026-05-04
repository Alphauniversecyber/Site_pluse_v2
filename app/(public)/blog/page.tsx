import type { Metadata } from "next";

import { BlogIndexClient } from "@/components/blog/blog-index-client";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-json-ld";
import { BLOG_BASE_URL, getAllBlogPosts } from "@/lib/blog-posts";
import { buildPageMetadata, PUBLIC_SITE_URL } from "@/lib/seo";

const posts = getAllBlogPosts();

export const metadata: Metadata = buildPageMetadata({
  title: "Agency Growth Blog - SitePulse",
  description:
    "Practical SEO, reporting, retention, and sales guides for digital agencies that want better audits and stronger client relationships.",
  path: "/blog",
  keywords: [
    "agency SEO blog",
    "SEO audit strategy",
    "client reporting guides",
    "agency retention tips",
    "white-label reporting blog",
    "digital agency growth content"
  ],
  imageUrl:
    "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1600&q=80",
  imageAlt: "SitePulse agency growth blog"
});

const blogSchema = {
  "@context": "https://schema.org",
  "@type": "Blog",
  name: "Agency Growth Blog",
  url: BLOG_BASE_URL,
  description:
    "Practical SEO, reporting, retention, and sales guides for digital agencies that want better audits and stronger client relationships.",
  publisher: {
    "@type": "Organization",
    name: "SitePulse",
    url: PUBLIC_SITE_URL
  },
  blogPost: posts.map((post) => ({
    "@type": "BlogPosting",
    headline: post.title,
    url: `${BLOG_BASE_URL}/${post.slug}`,
    datePublished: post.publishedAt,
    description: post.excerpt,
    image: post.coverImage
  }))
};

const blogCollectionSchema = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "SitePulse Blog",
  url: BLOG_BASE_URL,
  mainEntity: {
    "@type": "ItemList",
    itemListElement: posts.map((post, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: `${BLOG_BASE_URL}/${post.slug}`,
      name: post.title
    }))
  }
};

export default function BlogPage() {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", item: PUBLIC_SITE_URL },
          { name: "Blog", item: BLOG_BASE_URL }
        ]}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(blogSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(blogCollectionSchema) }}
      />
      <BlogIndexClient posts={posts} />
    </>
  );
}
