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
    <div className={cn("flex flex-col gap-4 sm:gap-5 lg:flex-row lg:items-end lg:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary sm:text-xs sm:tracking-[0.32em]">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-2.5 break-words font-display text-2xl font-semibold sm:text-3xl md:mt-3 md:text-4xl">
          {title}
        </h1>
        <p className="mt-2.5 max-w-2xl break-words text-sm leading-6 text-muted-foreground md:mt-3 md:text-base">
          {description}
        </p>
      </div>
      {actions ? <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center lg:w-auto">{actions}</div> : null}
    </div>
  );
}
