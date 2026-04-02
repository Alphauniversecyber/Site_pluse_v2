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
      <div
        className={cn(
          "inline-flex h-11 items-center rounded-full border border-border bg-card/80 p-1 shadow-sm",
          className
        )}
      >
        <div className="h-9 w-[118px] rounded-full bg-muted/70" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border border-border bg-card/80 p-1 shadow-[0_10px_40px_-28px_rgba(15,23,42,0.5)] backdrop-blur",
        className
      )}
      role="group"
      aria-label="Theme selector"
    >
      {options.map((option) => {
        const Icon = option.icon;
        const active = option.value === theme;

        return (
          <Button
            key={option.value}
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setTheme(option.value)}
            className={cn(
              "h-9 rounded-full px-3 text-xs font-medium tracking-[0.08em]",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
            aria-pressed={active}
            aria-label={option.label}
            title={option.label}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{option.value}</span>
          </Button>
        );
      })}
    </div>
  );
}
