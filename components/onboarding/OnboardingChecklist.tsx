"use client";

import { CheckCircle2, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  ONBOARDING_STORAGE_KEY,
  ONBOARDING_CONGRATS_KEY,
  ONBOARDING_DISMISSED_KEY,
  mergeOnboardingSteps,
  readOnboardingSteps,
} from "@/lib/onboarding";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const checklistSteps = [
  "Add your first website",
  "Run your first scan",
  "View your scan report",
  "Set up your branding (logo + colours)",
  "Share a client dashboard link"
] as const;

function isDismissed() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(ONBOARDING_DISMISSED_KEY) === "1";
}

function hasShownCongrats() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(ONBOARDING_CONGRATS_KEY) === "1";
}

export function OnboardingChecklist({ detectedSteps }: { detectedSteps: boolean[] }) {
  const [steps, setSteps] = useState(() => mergeOnboardingSteps(detectedSteps));
  const [dismissed, setDismissed] = useState(false);
  const [showCongrats, setShowCongrats] = useState(false);

  useEffect(() => {
    const syncState = () => {
      const nextSteps = mergeOnboardingSteps(readOnboardingSteps(), detectedSteps);
      window.localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(nextSteps));
      setSteps(nextSteps);

      const completed = nextSteps.every(Boolean);
      const dismissedValue = isDismissed();
      const congratsShown = hasShownCongrats();

      setDismissed(dismissedValue);
      setShowCongrats(completed && !congratsShown);
    };

    syncState();

    const handleUpdate = () => {
      syncState();
    };

    window.addEventListener("sitepulse:onboarding-updated", handleUpdate as EventListener);

    return () => {
      window.removeEventListener("sitepulse:onboarding-updated", handleUpdate as EventListener);
    };
  }, [detectedSteps]);

  const completedCount = useMemo(() => steps.filter(Boolean).length, [steps]);

  if (showCongrats) {
    return (
      <Card className="border-emerald-200 bg-emerald-50/80 shadow-sm dark:border-emerald-500/20 dark:bg-emerald-500/10">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
              <Sparkles className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-[0.18em]">Onboarding complete</span>
            </div>
            <p className="text-base font-semibold text-foreground">You finished the first-run setup.</p>
            <p className="text-sm text-muted-foreground">
              SitePulse is ready for live client delivery, branded reporting, and dashboard sharing.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              window.localStorage.setItem(ONBOARDING_CONGRATS_KEY, "1");
              window.localStorage.setItem(ONBOARDING_DISMISSED_KEY, "1");
              setShowCongrats(false);
              setDismissed(true);
            }}
          >
            Dismiss
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (dismissed || steps.every(Boolean)) {
    return null;
  }

  return (
    <Card className="border-border/80">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">First-run checklist</p>
          <CardTitle className="text-xl">Set up the full client delivery flow</CardTitle>
          <p className="text-sm text-muted-foreground">
            {completedCount}/5 completed
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={() => {
            window.localStorage.setItem(ONBOARDING_DISMISSED_KEY, "1");
            setDismissed(true);
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="grid gap-3">
        {checklistSteps.map((label, index) => (
          <div
            key={label}
            className={cn(
              "flex items-center gap-3 rounded-2xl border px-4 py-3",
              steps[index]
                ? "border-emerald-200 bg-emerald-50/80 dark:border-emerald-500/20 dark:bg-emerald-500/10"
                : "border-border/80 bg-background"
            )}
          >
            <CheckCircle2
              className={cn(
                "h-5 w-5 shrink-0",
                steps[index] ? "text-emerald-600 dark:text-emerald-300" : "text-muted-foreground"
              )}
            />
            <span className={cn("text-sm", steps[index] ? "text-foreground" : "text-muted-foreground")}>
              {label}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
