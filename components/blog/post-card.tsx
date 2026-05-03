import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { format } from "date-fns";

import { CategoryBadge } from "@/components/blog/category-badge";
import type { BlogPost } from "@/lib/blog-posts";
import { cn } from "@/lib/utils";

function formatBlogDate(value: string) {
  return format(new Date(value), "MMM d, yyyy");
}

export function PostCard({
  post,
  className
}: {
  post: BlogPost;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "group overflow-hidden rounded-[1.9rem] border border-border/80 bg-card/[0.88] shadow-[0_28px_90px_-58px_rgba(15,23,42,0.9)] transition-[transform,border-color,box-shadow] duration-300 hover:-translate-y-1 hover:border-primary/25 hover:shadow-[0_34px_100px_-54px_rgba(59,130,246,0.28)]",
        className
      )}
    >
      <Link href={`/blog/${post.slug}` as Route} className="block h-full">
        <div className="relative aspect-[16/10] overflow-hidden border-b border-border/80">
          <Image
            src={post.coverImage}
            alt={post.title}
            fill
            sizes="(min-width: 1280px) 380px, (min-width: 768px) 50vw, 100vw"
            className="object-cover transition duration-500 group-hover:scale-[1.03]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/10 to-transparent" />
        </div>
        <div className="flex h-[calc(100%-1px)] flex-col p-6">
          <div className="flex items-center justify-between gap-3">
            <CategoryBadge category={post.category} />
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {post.readTime}
            </p>
          </div>
          <h3 className="mt-5 font-display text-2xl font-semibold leading-tight tracking-tight transition-colors group-hover:text-primary">
            {post.title}
          </h3>
          <p className="mt-3 line-clamp-2 text-sm leading-7 text-muted-foreground">
            {post.excerpt}
          </p>
          <div className="mt-6 flex items-center justify-between gap-4 text-sm text-muted-foreground">
            <span>{formatBlogDate(post.publishedAt)}</span>
            <span className="inline-flex items-center gap-2 font-medium text-foreground">
              Read article
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}
