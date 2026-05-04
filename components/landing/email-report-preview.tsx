import { HtmlTemplatePreview } from "@/components/shared/html-template-preview";
import { buildPreviewEmailHtml } from "@/lib/report-preview-data";
import { cn } from "@/lib/utils";

const previewEmailHtml = buildPreviewEmailHtml({
  agencyName: "SitePulse",
  emailFromName: "SitePulse",
  replyToEmail: "reports@sitepulse.io",
  agencyWebsiteUrl: "https://sitepulse.io"
});

export function EmailReportPreview({
  compact = false,
  className
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex h-full w-full items-start justify-center overflow-hidden rounded-[1.7rem] border border-slate-300/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(244,247,251,0.98))] shadow-[0_36px_90px_-56px_rgba(15,23,42,0.42)]",
        compact
          ? "p-2.5 sm:p-3"
          : "p-3 sm:p-4",
        className
      )}
    >
      <div className="w-full overflow-hidden rounded-[1.35rem] border border-slate-200 bg-white shadow-[0_24px_60px_-40px_rgba(15,23,42,0.2)]">
        <div className="flex h-full justify-center bg-slate-100/80 p-2.5 sm:p-3">
          <HtmlTemplatePreview
            html={previewEmailHtml}
            title="Weekly email report preview"
            width={760}
            height={1220}
            scale={compact ? 0.56 : 0.87}
            className="rounded-[1rem]"
            iframeClassName="rounded-[1rem] shadow-[0_18px_44px_-32px_rgba(15,23,42,0.22)]"
          />
        </div>
      </div>
    </div>
  );
}
