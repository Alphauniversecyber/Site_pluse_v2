import { Badge } from "@/components/ui/badge";
import type { BlogCategory } from "@/lib/blog-posts";
import { cn } from "@/lib/utils";

const categoryStyles: Record<BlogCategory, string> = {
  Strategy: "border-sky-500/20 bg-sky-500/10 text-sky-300 dark:text-sky-300",
  Reporting: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300 dark:text-emerald-300",
  Retention: "border-amber-500/20 bg-amber-500/10 text-amber-300 dark:text-amber-300",
  Branding: "border-fuchsia-500/20 bg-fuchsia-500/10 text-fuchsia-300 dark:text-fuchsia-300",
  Sales: "border-rose-500/20 bg-rose-500/10 text-rose-300 dark:text-rose-300",
  Education: "border-violet-500/20 bg-violet-500/10 text-violet-300 dark:text-violet-300"
};

export function CategoryBadge({
  category,
  className
}: {
  category: BlogCategory;
  className?: string;
}) {
  return (
    <Badge
      className={cn(
        "rounded-full border px-3 py-1 text-[11px] tracking-[0.22em]",
        categoryStyles[category],
        className
      )}
    >
      {category}
    </Badge>
  );
}
