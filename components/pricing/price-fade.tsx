"use client";

import { useEffect, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export function PriceFade({
  trigger,
  className,
  children
}: {
  trigger: string;
  className?: string;
  children: ReactNode;
}) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(false);
    const timeout = window.setTimeout(() => setVisible(true), 16);

    return () => window.clearTimeout(timeout);
  }, [trigger]);

  return (
    <div
      className={cn(
        "transition-opacity duration-150 ease-out",
        visible ? "opacity-100" : "opacity-0",
        className
      )}
    >
      {children}
    </div>
  );
}
