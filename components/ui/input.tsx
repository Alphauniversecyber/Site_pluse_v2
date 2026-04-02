import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full min-w-0 rounded-xl border border-border bg-background px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground transition-[border-color,box-shadow,background-color] focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/10 aria-[invalid=true]:border-rose-500 aria-[invalid=true]:focus-visible:ring-rose-500/10 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
