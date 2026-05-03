"use client";

import Image from "next/image";
import { ImageIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

export function LogoPreview({
  src,
  alt,
  fallbackTitle,
  fallbackBody,
  className,
  imageClassName
}: {
  src?: string | null;
  alt: string;
  fallbackTitle: string;
  fallbackBody?: string;
  className?: string;
  imageClassName?: string;
}) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  const showImage = Boolean(src) && !hasError;

  return (
    <div
      className={cn(
        "flex min-h-[96px] w-full items-center justify-start overflow-hidden rounded-[1.5rem] border border-border bg-muted/40 p-4",
        className
      )}
    >
      {showImage ? (
        <Image
          src={src ?? ""}
          alt={alt}
          onError={() => setHasError(true)}
          width={320}
          height={128}
          unoptimized
          className={cn("block max-h-16 max-w-full object-contain object-left", imageClassName)}
        />
      ) : (
        <div className="flex items-center gap-4 text-muted-foreground">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-dashed border-border bg-background">
            <ImageIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-foreground">{fallbackTitle}</p>
            {fallbackBody ? <p className="mt-1 text-sm text-muted-foreground">{fallbackBody}</p> : null}
          </div>
        </div>
      )}
    </div>
  );
}
