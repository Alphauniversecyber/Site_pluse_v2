"use client";

import { Laptop, MoonStar, SunMedium } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme/theme-provider";

const options = [
  { value: "light", label: "Light mode", icon: SunMedium },
  { value: "dark", label: "Dark mode", icon: MoonStar },
  { value: "system", label: "System theme", icon: Laptop }
] as const;

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-10 w-10 rounded-2xl border border-border bg-card/60" />
        ))}
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2", className)} role="group" aria-label="Theme selector">
      {options.map((option) => {
        const Icon = option.icon;
        const active = option.value === theme;

        return (
          <Button
            key={option.value}
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setTheme(option.value)}
            className={cn(
              "header-action-button motion-safe:hover:scale-100 motion-safe:active:scale-100",
              active && "text-primary"
            )}
            data-state={active ? "active" : "inactive"}
            aria-pressed={active}
            aria-label={option.label}
            title={option.label}
          >
            <Icon className="h-[18px] w-[18px]" strokeWidth={1.9} />
            <span className="sr-only">{option.value}</span>
          </Button>
        );
      })}
    </div>
  );
}
