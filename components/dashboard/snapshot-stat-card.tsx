import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export function SnapshotStatCard({
  label,
  value,
  icon: Icon,
  iconTone,
  iconBg
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  iconTone: string;
  iconBg: string;
}) {
  return (
    <div className="flex h-full min-h-[164px] min-w-0 flex-col rounded-3xl border border-border bg-background p-5 sm:p-6">
      <div className="flex flex-1 flex-col gap-4 min-w-0">
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
            iconBg,
            iconTone
          )}
        >
          <Icon className="h-5 w-5" />
        </div>

        <div className="min-h-[3.25rem] min-w-0">
          <p className="text-sm leading-6 text-muted-foreground break-words whitespace-normal">
            {label}
          </p>
        </div>
      </div>

      <div className="pt-5">
        <p className="font-display text-4xl font-semibold leading-none">{value}</p>
      </div>
    </div>
  );
}
