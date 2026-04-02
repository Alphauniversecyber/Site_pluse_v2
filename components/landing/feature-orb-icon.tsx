import { cn } from "@/lib/utils";

export function FeatureOrbIcon({
  kind,
  className
}: {
  kind: "scanning" | "seo" | "accessibility" | "pdf" | "alerts" | "trends";
  className?: string;
}) {
  const iconMap = {
    scanning: {
      src: "https://cdn.jsdelivr.net/npm/lucide-static@latest/icons/activity.svg",
      animation: "feature-icon-subtle-pulse"
    },
    pdf: {
      src: "https://cdn.jsdelivr.net/npm/lucide-static@latest/icons/file-text.svg",
      animation: ""
    },
    accessibility: {
      src: "https://cdn.jsdelivr.net/npm/lucide-static@latest/icons/accessibility.svg",
      animation: ""
    },
    alerts: {
      src: "https://cdn.jsdelivr.net/npm/lucide-static@latest/icons/bell.svg",
      animation: "feature-icon-subtle-tilt"
    },
    trends: {
      src: "https://cdn.jsdelivr.net/npm/lucide-static@latest/icons/bar-chart-2.svg",
      animation: "feature-icon-subtle-rise"
    },
    seo: {
      src: "https://cdn.jsdelivr.net/npm/lucide-static@latest/icons/smartphone.svg",
      animation: ""
    }
  }[kind];

  return (
    <span className={cn("feature-icon-shell", className)}>
      <span
        aria-hidden="true"
        className={cn("feature-icon-glyph", iconMap.animation)}
        style={{
          WebkitMaskImage: `url(${iconMap.src})`,
          maskImage: `url(${iconMap.src})`
        }}
      />
    </span>
  );
}
