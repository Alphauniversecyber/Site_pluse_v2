import { cn } from "@/lib/utils";

export function MetricTile({
  label,
  shortLabel,
  value,
  className,
  valueClassName
}: {
  label: string;
  shortLabel?: string;
  value: React.ReactNode;
  className?: string;
  valueClassName?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[6.75rem] min-w-0 flex-col items-center justify-between rounded-2xl border border-border bg-card px-3.5 py-3 text-center sm:min-h-[7.1rem] sm:px-4 sm:py-3.5",
        className
      )}
      title={label}
    >
      <p className="min-h-[2.5rem] max-w-full whitespace-normal break-words text-balance text-[11px] font-semibold uppercase leading-[1.35] tracking-[0.12em] text-foreground/68 sm:text-xs">
        {shortLabel ?? label}
      </p>
      <div className="mt-3 flex min-h-[2rem] items-end justify-center">
        <p
          className={cn(
            "text-center font-display text-2xl font-semibold leading-none tracking-tight sm:text-[1.75rem]",
            valueClassName
          )}
        >
          {value}
        </p>
      </div>
    </div>
  );
}
