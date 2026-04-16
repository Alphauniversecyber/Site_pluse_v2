"use client";

import type { BillingCycle } from "@/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function BillingCycleToggle({
  value,
  onChange,
  className
}: {
  value: BillingCycle;
  onChange: (value: BillingCycle) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-center", className)}>
      <div className="inline-flex rounded-full border border-border/80 bg-background/80 p-1 shadow-[0_14px_40px_-28px_rgba(15,23,42,0.3)]">
        {(["monthly", "yearly"] as const).map((cycle) => {
          const active = value === cycle;

          return (
            <button
              key={cycle}
              type="button"
              onClick={() => onChange(cycle)}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-semibold transition-all duration-150 ease-out sm:px-5",
                active
                  ? "bg-primary text-primary-foreground shadow-[0_16px_34px_-24px_rgba(59,130,246,0.8)]"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {cycle === "monthly" ? "Monthly" : "Yearly"}
            </button>
          );
        })}
      </div>

      {value === "yearly" ? (
        <Badge
          variant="success"
          className="w-fit rounded-full px-3 py-1 text-[13px] font-medium normal-case tracking-normal"
        >
          Save up to 19%
        </Badge>
      ) : null}
    </div>
  );
}
