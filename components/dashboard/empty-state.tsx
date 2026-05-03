import Link from "next/link";
import type { Route } from "next";
import type { LucideIcon } from "lucide-react";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

export function EmptyState({
  title,
  description,
  icon: Icon = Sparkles,
  action,
  actionLabel,
  actionHref,
  className
}: {
  title: string;
  description: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
  actionLabel?: string;
  actionHref?: Route;
  className?: string;
}) {
  return (
    <div
      className={[
        "rounded-[2rem] border border-border/80 bg-card/72 p-10 text-center shadow-[0_24px_70px_-52px_rgba(15,23,42,0.24)]",
        className
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-primary/15 bg-primary/10 text-primary">
        <Icon className="h-8 w-8" />
      </div>
      <h3 className="mt-5 font-display text-2xl font-semibold">{title}</h3>
      <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground">{description}</p>
      {action ? (
        <div className="mt-6 flex justify-center">{action}</div>
      ) : actionLabel && actionHref ? (
        <Button asChild className="mt-6">
          <Link href={actionHref}>{actionLabel}</Link>
        </Button>
      ) : null}
    </div>
  );
}
