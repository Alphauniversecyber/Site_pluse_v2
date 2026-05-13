import { HtmlTemplatePreview } from "@/components/shared/html-template-preview";
import { buildPreviewReportHtml } from "@/lib/report-preview-data";
import { cn } from "@/lib/utils";

const previewReportHtml = buildPreviewReportHtml({
  agencyName: "SitePulse",
  emailFromName: "SitePulse",
  replyToEmail: "reports@trysitepulse.com",
  agencyWebsiteUrl: "https://www.trysitepulse.com"
}).replace(
  '<p style="font-size:14px;color:#94A3B8;margin:0 0 54px">SitePulse</p>',
  '<img src="/brand/sitepulse-logo-dark.svg" alt="SitePulse" style="height:20px;width:auto;object-fit:contain;margin:0 0 54px"/>'
);

export function PdfReportPreview({
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
            html={previewReportHtml}
            title="Monthly PDF report preview"
            width={920}
            height={1280}
            scale={compact ? 0.54 : 0.69}
            className="rounded-[1rem]"
            iframeClassName="rounded-[1rem] shadow-[0_18px_44px_-32px_rgba(15,23,42,0.22)]"
          />
        </div>
      </div>
    </div>
  );
}
