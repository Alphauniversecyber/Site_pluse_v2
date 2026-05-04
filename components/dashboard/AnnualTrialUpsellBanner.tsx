"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const ANNUAL_UPSELL_DISMISSED_KEY = "sitepulse_annual_upsell_dismissed";

function getTrialDay(createdAt: string) {
  const startedAt = new Date(createdAt).getTime();
  if (!Number.isFinite(startedAt)) {
    return -1;
  }

  return Math.floor((Date.now() - startedAt) / (24 * 60 * 60 * 1000));
}

export function AnnualTrialUpsellBanner({
  isTrial,
  createdAt
}: {
  isTrial: boolean;
  createdAt: string;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isTrial) {
      setVisible(false);
      return;
    }

    const dismissed = window.localStorage.getItem(ANNUAL_UPSELL_DISMISSED_KEY) === "1";
    const trialDay = getTrialDay(createdAt);
    setVisible(!dismissed && trialDay >= 6 && trialDay <= 8);
  }, [createdAt, isTrial]);

  if (!visible) {
    return null;
  }

  return (
    <Card className="border-amber-300/70 bg-amber-50/90 dark:border-amber-500/20 dark:bg-amber-500/10">
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">
            Annual savings
          </p>
          <p className="text-sm font-medium text-foreground">
            Save 16% and lock in your founding price — switch to annual today.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild className="bg-amber-500 text-white hover:bg-amber-600">
            <Link href="/pricing">See annual pricing</Link>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => {
              window.localStorage.setItem(ANNUAL_UPSELL_DISMISSED_KEY, "1");
              setVisible(false);
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
