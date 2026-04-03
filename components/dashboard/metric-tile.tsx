import { cn } from "@/lib/utils";

export function MetricTile({
  label,
  value,
  className,
  valueClassName
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
  valueClassName?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[7.5rem] min-w-0 flex-col rounded-2xl border border-border bg-card p-3.5 sm:p-4",
        className
      )}
    >
      <p className="min-h-[2.8rem] whitespace-normal break-words text-[11px] font-medium uppercase leading-[1.35] tracking-[0.14em] text-muted-foreground [overflow-wrap:anywhere]">
        {label}
      </p>
      <div className="mt-auto pt-3">
        <p
          className={cn(
            "font-display text-2xl font-semibold leading-none tracking-tight sm:text-[1.75rem]",
            valueClassName
          )}
        >
          {value}
        </p>
      </div>
    </div>
  );
}
