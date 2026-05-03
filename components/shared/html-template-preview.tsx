import { cn } from "@/lib/utils";

type HtmlTemplatePreviewProps = {
  html: string;
  title: string;
  width: number;
  height: number;
  scale: number;
  className?: string;
  iframeClassName?: string;
};

export function HtmlTemplatePreview({
  html,
  title,
  width,
  height,
  scale,
  className,
  iframeClassName
}: HtmlTemplatePreviewProps) {
  return (
    <div
      className={cn("overflow-hidden", className)}
      style={{
        width: Math.round(width * scale),
        maxWidth: "100%",
        height: Math.round(height * scale)
      }}
    >
      <div
        style={{
          width,
          height,
          transform: `scale(${scale})`,
          transformOrigin: "top left"
        }}
      >
        <iframe
          title={title}
          srcDoc={html}
          sandbox="allow-same-origin"
          loading="lazy"
          className={cn("h-full w-full border-0 bg-white", iframeClassName)}
        />
      </div>
    </div>
  );
}
