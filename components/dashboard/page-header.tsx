import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between", className)}>
      <div>
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-primary">{eyebrow}</p>
        ) : null}
        <h1 className="mt-3 font-display text-3xl font-semibold md:text-4xl">{title}</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground md:text-base">{description}</p>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </div>
  );
}
