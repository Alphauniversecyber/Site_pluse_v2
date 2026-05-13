import type { Metadata } from "next";
import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";

import { BlogMarkdown } from "@/components/blog/blog-markdown";
import { CategoryBadge } from "@/components/blog/category-badge";
import { PostCard } from "@/components/blog/post-card";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-json-ld";
import { Button } from "@/components/ui/button";
import {
  BLOG_AUTHOR_NAME,
  BLOG_BASE_URL,
  BLOG_SITE_URL,
  getAllBlogPosts,
  getBlogPostBySlug,
  getRelatedBlogPosts
} from "@/lib/blog-posts";

type BlogPostPageProps = {
  params: {
    slug: string;
  };
};

function formatBlogDate(value: string) {
  return format(new Date(value), "MMMM d, yyyy");
}

export function generateStaticParams() {
  return getAllBlogPosts().map((post) => ({
    slug: post.slug
  }));
}

export function generateMetadata({ params }: BlogPostPageProps): Metadata {
  const post = getBlogPostBySlug(params.slug);

  if (!post) {
    return {
      title: {
        absolute: "Article Not Found | SitePulse Blog"
      }
    };
  }

  const canonicalUrl = `${BLOG_BASE_URL}/${post.slug}`;

  return {
    title: {
      absolute: `${post.title} | SitePulse Blog`
    },
    description: post.excerpt,
    keywords: post.keywords,
    alternates: {
      canonical: canonicalUrl
    },
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: "article",
      url: canonicalUrl,
      publishedTime: post.publishedAt,
      authors: ["SitePulse"],
      images: [
        {
          url: post.coverImage,
          alt: post.title
        }
      ]
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.excerpt,
      images: [post.coverImage]
    }
  };
}

export default function BlogPostPage({ params }: BlogPostPageProps) {
  const post = getBlogPostBySlug(params.slug);

  if (!post) {
    notFound();
  }

  const relatedPosts = getRelatedBlogPosts(post, 2);
  const canonicalUrl = `${BLOG_BASE_URL}/${post.slug}`;
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt,
    image: post.coverImage,
    datePublished: post.publishedAt,
    author: {
      "@type": "Organization",
      name: "SitePulse",
      url: BLOG_SITE_URL
    },
    publisher: {
      "@type": "Organization",
      name: "SitePulse",
      url: BLOG_SITE_URL
    },
    mainEntityOfPage: canonicalUrl
  };

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", item: BLOG_SITE_URL },
          { name: "Blog", item: BLOG_BASE_URL },
          { name: post.title, item: canonicalUrl }
        ]}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />

      <main className="pb-24 pt-10 md:pb-28 md:pt-14">
        <section className="container">
          <div className="mx-auto max-w-4xl">
            <CategoryBadge category={post.category} />
            <h1 className="mt-6 font-display text-4xl font-semibold tracking-tight md:text-6xl">
              {post.title}
            </h1>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">
              {post.excerpt}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{BLOG_AUTHOR_NAME}</span>
              <span className="hidden h-1 w-1 rounded-full bg-border sm:inline-flex" />
              <span>{formatBlogDate(post.publishedAt)}</span>
              <span className="hidden h-1 w-1 rounded-full bg-border sm:inline-flex" />
              <span>{post.readTime} read</span>
            </div>
          </div>
        </section>

        <section className="container mt-10">
          <div className="mx-auto max-w-5xl overflow-hidden rounded-[2.1rem] border border-border/80 bg-card/70 shadow-[0_30px_100px_-62px_rgba(15,23,42,0.92)]">
            <div className="relative aspect-[16/8] min-h-[260px]">
              <Image
                src={post.coverImage}
                alt={post.title}
                fill
                sizes="(min-width: 1280px) 960px, 100vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/55 to-transparent" />
            </div>
          </div>
        </section>

        <section className="container mt-12">
          <article className="mx-auto max-w-3xl">
            <BlogMarkdown content={post.content} />
          </article>
        </section>

        <section className="container mt-16">
          <div className="mx-auto max-w-6xl">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
                  More articles
                </p>
                <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight">
                  Keep building the agency playbook
                </h2>
              </div>
              <Link
                href={"/blog" as Route}
                className="hidden text-sm font-medium text-muted-foreground transition-colors hover:text-foreground md:inline-flex"
              >
                View all articles
              </Link>
            </div>

            <div className="mt-8 grid gap-6 md:grid-cols-2">
              {relatedPosts.map((relatedPost) => (
                <PostCard key={relatedPost.slug} post={relatedPost} />
              ))}
            </div>
          </div>
        </section>

        <section className="container mt-16">
          <div className="mx-auto max-w-5xl overflow-hidden rounded-[2.25rem] border border-primary/15 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.16),transparent_38%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96))] px-6 py-10 shadow-[0_30px_90px_-58px_rgba(15,23,42,0.5)] dark:bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.22),transparent_38%),linear-gradient(180deg,rgba(30,41,59,0.96),rgba(15,23,42,0.94))] md:px-10 md:py-12">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
              Ready to automate your agency reporting?
            </p>
            <div className="mt-4 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div className="max-w-2xl">
                <h2 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
                  Turn audits, monitoring, and reporting into a client-ready growth system.
                </h2>
                <p className="mt-4 text-base leading-8 text-muted-foreground">
                  Start free, generate cleaner reports, and keep account momentum visible long after the first audit is delivered.
                </p>
              </div>
              <Button asChild size="lg" className="rounded-2xl px-6">
                <Link href={"/signup" as Route}>Start free trial</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
