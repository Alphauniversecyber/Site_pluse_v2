import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref
}: {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="rounded-[2rem] border border-dashed border-border bg-card/50 p-10 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Sparkles className="h-8 w-8" />
      </div>
      <h3 className="mt-5 font-display text-2xl font-semibold">{title}</h3>
      <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground">{description}</p>
      {actionLabel && actionHref ? (
        <Button asChild className="mt-6">
          <a href={actionHref}>{actionLabel}</a>
        </Button>
      ) : null}
    </div>
  );
}
