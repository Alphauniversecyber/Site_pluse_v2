"use client";

import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";

import { CategoryBadge } from "@/components/blog/category-badge";
import { PostCard } from "@/components/blog/post-card";
import { Button } from "@/components/ui/button";
import {
  type BlogPost,
  blogCategories,
  type BlogCategory
} from "@/lib/blog-posts";
import { cn } from "@/lib/utils";

function formatBlogDate(value: string) {
  return format(new Date(value), "MMMM d, yyyy");
}

export function BlogIndexClient({ posts }: { posts: BlogPost[] }) {
  const [activeCategory, setActiveCategory] = useState<(typeof blogCategories)[number]>("All");

  const visiblePosts =
    activeCategory === "All"
      ? posts
      : posts.filter((post) => post.category === activeCategory);

  const featuredPost = visiblePosts[0] ?? posts[0];
  const remainingPosts = visiblePosts.filter((post) => post.slug !== featuredPost.slug);
  const emptyMessage =
    activeCategory === "All"
      ? "No articles are available yet."
      : `No ${activeCategory.toLowerCase()} articles are available yet.`;

  return (
    <main className="pb-24 pt-10 md:pb-28 md:pt-14">
      <section className="container">
        <div className="relative overflow-hidden rounded-[2.25rem] border border-border/80 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.18),transparent_38%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(15,23,42,0.82))] px-6 py-10 shadow-[0_30px_100px_-56px_rgba(15,23,42,0.95)] md:px-10 md:py-14">
          <div className="absolute inset-y-0 right-0 hidden w-[36%] bg-grid bg-[length:34px_34px] opacity-[0.08] lg:block" />
          <div className="relative max-w-4xl">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary/90">
              Blog
            </p>
            <h1 className="mt-5 max-w-3xl font-display text-4xl font-semibold tracking-tight text-white md:text-6xl">
              The Agency Growth Blog
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300 md:text-lg">
              Practical guides for agencies that want better audits, stronger reporting, and clients that stay.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {blogCategories.map((category) => (
                <Button
                  key={category}
                  type="button"
                  variant={activeCategory === category ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveCategory(category)}
                  className={cn(
                    "rounded-full px-4 text-[11px] uppercase tracking-[0.18em]",
                    activeCategory === category
                      ? "border-primary/20 bg-primary/90 text-primary-foreground"
                      : "border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08] hover:text-white"
                  )}
                >
                  {category}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="container mt-10 md:mt-14">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
              Featured article
            </p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight md:text-4xl">
              Lead with a stronger story than the export gives you
            </h2>
          </div>
          <p className="hidden text-sm leading-7 text-muted-foreground lg:block">
            A sharper editorial layer for agencies evaluating reporting, audits, and retention systems.
          </p>
        </div>

        <article className="mt-8 overflow-hidden rounded-[2.2rem] border border-border/80 bg-card/[0.9] shadow-[0_32px_110px_-64px_rgba(15,23,42,0.92)]">
          <div className="grid lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,0.92fr)] lg:items-stretch">
            <div className="flex flex-col justify-between p-6 md:p-8 lg:p-10">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <CategoryBadge category={featuredPost.category as BlogCategory} />
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    {featuredPost.readTime}
                  </p>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    {formatBlogDate(featuredPost.publishedAt)}
                  </p>
                </div>
                <h3 className="mt-6 max-w-2xl font-display text-3xl font-semibold leading-tight tracking-tight md:text-[2.5rem]">
                  {featuredPost.title}
                </h3>
                <p className="mt-5 max-w-2xl text-base leading-8 text-muted-foreground md:text-lg">
                  {featuredPost.excerpt}
                </p>
              </div>
              <div className="mt-8">
                <Link
                  href={`/blog/${featuredPost.slug}` as Route}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-primary transition-colors hover:text-foreground"
                >
                  Read article
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            <Link
              href={`/blog/${featuredPost.slug}` as Route}
              className="relative block min-h-[300px] border-t border-border/80 lg:min-h-full lg:border-l lg:border-t-0"
            >
              <Image
                src={featuredPost.coverImage}
                alt={featuredPost.title}
                fill
                sizes="(min-width: 1024px) 45vw, 100vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-tr from-slate-950/70 via-slate-950/20 to-transparent" />
            </Link>
          </div>
        </article>
      </section>

      <section className="container mt-12 md:mt-16">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
              All articles
            </p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight">
              Practical writing for agency operators
            </h2>
          </div>
          <p className="text-sm text-muted-foreground">
            {visiblePosts.length} article{visiblePosts.length === 1 ? "" : "s"}
          </p>
        </div>

        {remainingPosts.length > 0 ? (
          <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {remainingPosts.map((post) => (
              <PostCard key={post.slug} post={post} />
            ))}
          </div>
        ) : (
          <div className="mt-8 rounded-[1.8rem] border border-dashed border-border/80 bg-card/60 px-6 py-12 text-center text-muted-foreground">
            {emptyMessage}
          </div>
        )}
      </section>
    </main>
  );
}
