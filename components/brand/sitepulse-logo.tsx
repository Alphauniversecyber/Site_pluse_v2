import Image from "next/image";

import { cn } from "@/lib/utils";

export function SitePulseLogo({
  variant = "dark",
  markOnly = false,
  className,
  priority = false
}: {
  variant?: "light" | "dark";
  markOnly?: boolean;
  className?: string;
  priority?: boolean;
}) {
  const src = markOnly
    ? "/brand/sitepulse-mark.svg"
    : variant === "light"
      ? "/brand/sitepulse-logo-light.svg"
      : "/brand/sitepulse-logo-dark.svg";

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center overflow-visible align-middle",
        markOnly ? "h-11 w-11" : "h-10 w-[152px] max-w-full sm:w-[164px] md:w-[180px]",
        className
      )}
    >
      <Image
        src={src}
        alt="SitePulse"
        fill
        priority={priority}
        sizes={markOnly ? "44px" : "(max-width: 640px) 152px, (max-width: 768px) 164px, 180px"}
        className={cn(
          "max-w-full object-contain",
          markOnly ? "object-center" : "object-left"
        )}
      />
    </span>
  );
}
