import { SitePulseLogo } from "@/components/brand/sitepulse-logo";
import { HtmlTemplatePreview } from "@/components/shared/html-template-preview";
import { buildPreviewReportHtml } from "@/lib/report-preview-data";
import { cn } from "@/lib/utils";

const previewReportHtml = buildPreviewReportHtml({
  agencyName: "SitePulse",
  emailFromName: "SitePulse",
  replyToEmail: "reports@sitepulse.io",
  agencyWebsiteUrl: "https://sitepulse.io"
});

export function PdfReportPreview({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={cn(
        "relative origin-top overflow-hidden rounded-[1.7rem] border border-slate-300/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(244,247,251,0.98))] shadow-[0_36px_90px_-56px_rgba(15,23,42,0.42)] transition duration-300",
        compact
          ? "md:scale-[0.94] lg:[transform:perspective(1400px)_rotateX(0.9deg)_scale(0.9)] xl:[transform:perspective(1400px)_rotateX(0.8deg)_scale(0.93)]"
          : "md:scale-[0.98] lg:[transform:perspective(1400px)_rotateX(1deg)_scale(0.95)] xl:[transform:perspective(1400px)_rotateX(0.9deg)_scale(0.97)]"
      )}
    >
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50",
          compact ? "px-3.5 py-2.5 sm:px-4" : "px-4 py-3 sm:px-5"
        )}
      >
        <div className="flex items-center gap-3">
          <div className="flex gap-2">
            <span className="h-3 w-3 rounded-full bg-[#EA4335]" />
            <span className="h-3 w-3 rounded-full bg-[#FBBC05]" />
            <span className="h-3 w-3 rounded-full bg-[#34A853]" />
          </div>
          <span className="text-sm text-slate-500">PDF preview</span>
        </div>
        <div className="max-w-full rounded-full bg-slate-100 px-4 py-1.5 text-sm text-slate-500">
          Monthly Website Report
        </div>
      </div>

      <div className={cn("bg-transparent", compact ? "p-3 sm:p-3.5 md:p-4" : "p-3.5 sm:p-4 md:p-5")}>
        <div className="overflow-hidden rounded-[1.45rem] border border-slate-200 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.2)]">
          <div
            className={cn(
              "flex flex-wrap items-center justify-between gap-3 rounded-t-[1.45rem] bg-[#0F172A]",
              compact ? "px-3.5 py-3 sm:px-4" : "px-4 py-3.5 sm:px-5"
            )}
          >
            <SitePulseLogo
              variant="dark"
              className={cn("max-w-full", compact ? "h-8 w-[138px]" : "h-9 w-[156px]")}
            />
            <span
              className={cn(
                "uppercase tracking-[0.24em] text-slate-400",
                compact ? "text-[10px]" : "text-xs"
              )}
            >
              Live PDF cover
            </span>
          </div>

          <div className="bg-slate-100/90 p-3 sm:p-4">
            <HtmlTemplatePreview
              html={previewReportHtml}
              title="Monthly PDF report preview"
              width={920}
              height={1280}
              scale={compact ? 0.44 : 0.48}
              className="rounded-[1.2rem]"
              iframeClassName="rounded-[1.2rem] shadow-[0_22px_50px_-36px_rgba(15,23,42,0.22)]"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
