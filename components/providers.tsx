"use client";

import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/theme/theme-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      {children}
      <Toaster
        richColors
        position="top-right"
        toastOptions={{
          className: "border border-border bg-background text-foreground"
        }}
      />
    </ThemeProvider>
  );
}
