"use client";

import { useMemo, type ReactNode } from "react";

import { HtmlTemplatePreview } from "@/components/shared/html-template-preview";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { buildPreviewEmailHtml, buildPreviewReportHtml } from "@/lib/report-preview-data";
import { cn } from "@/lib/utils";

export type BrandingPreviewTab = "pdf" | "email";

type BrandingPreviewPanelProps = {
  agencyName: string;
  brandColor: string;
  emailFromName: string;
  logoUrl?: string | null;
  replyToEmail?: string | null;
  agencyWebsiteUrl?: string | null;
  reportFooterText?: string | null;
  value?: BrandingPreviewTab;
  onValueChange?: (value: BrandingPreviewTab) => void;
  variant?: "panel" | "dialog";
  className?: string;
};

function PreviewCard({
  eyebrow,
  title,
  description,
  children,
  contentClassName
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  contentClassName?: string;
}) {
  return (
    <div className="rounded-[2rem] border border-slate-200 bg-slate-100 p-4 shadow-[0_26px_60px_-42px_rgba(15,23,42,0.35)]">
      <div className="overflow-hidden rounded-[1.65rem] border border-slate-200 bg-white shadow-[0_24px_60px_-40px_rgba(15,23,42,0.28)]">
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">{eyebrow}</p>
          <h3 className="mt-2 text-lg font-semibold tracking-tight text-slate-900">{title}</h3>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        <div className={cn("pointer-events-none bg-slate-100/90 p-4", contentClassName)}>{children}</div>
      </div>
    </div>
  );
}

export function BrandingPreviewPanel(props: BrandingPreviewPanelProps) {
  const activeTab = props.value ?? "pdf";
  const variant = props.variant ?? "panel";
  const previewOptions = {
    agencyName: props.agencyName,
    brandColor: props.brandColor,
    emailFromName: props.emailFromName,
    logoUrl: props.logoUrl,
    replyToEmail: props.replyToEmail,
    agencyWebsiteUrl: props.agencyWebsiteUrl,
    reportFooterText: props.reportFooterText
  };

  const emailHtml = useMemo(
    () => buildPreviewEmailHtml(previewOptions),
    [
      props.agencyName,
      props.brandColor,
      props.emailFromName,
      props.logoUrl,
      props.replyToEmail,
      props.agencyWebsiteUrl,
      props.reportFooterText
    ]
  );

  const reportHtml = useMemo(
    () => buildPreviewReportHtml(previewOptions),
    [
      props.agencyName,
      props.brandColor,
      props.emailFromName,
      props.logoUrl,
      props.replyToEmail,
      props.agencyWebsiteUrl,
      props.reportFooterText
    ]
  );

  const previewScales =
    variant === "dialog"
      ? {
          pdf: 0.72,
          email: 0.92
        }
      : {
          pdf: 0.46,
          email: 0.58
        };

  const tabContentClassName =
    variant === "dialog"
      ? "mt-0 pt-4"
      : "mt-0 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 pt-4";

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => props.onValueChange?.(value as BrandingPreviewTab)}
      className={cn(
        variant === "dialog" ? "flex flex-col" : "flex min-h-0 flex-col",
        props.className
      )}
    >
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 pb-4 backdrop-blur">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="pdf">PDF Report preview</TabsTrigger>
          <TabsTrigger value="email">Email preview</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent
        value="pdf"
        forceMount
        className={cn(
          tabContentClassName,
          activeTab !== "pdf" && "hidden"
        )}
      >
        <PreviewCard
          eyebrow="Rendered from live template"
          title="Branded PDF report"
          description="This preview uses the same HTML report template the dashboard PDF generator uses."
          contentClassName={variant === "dialog" ? "flex justify-center p-5" : "flex justify-center"}
        >
          <HtmlTemplatePreview
            html={reportHtml}
            title="PDF report preview"
            width={920}
            height={1280}
            scale={previewScales.pdf}
            className="rounded-[1.2rem]"
            iframeClassName="rounded-[1.2rem]"
          />
        </PreviewCard>
      </TabsContent>

      <TabsContent
        value="email"
        forceMount
        className={cn(
          tabContentClassName,
          activeTab !== "email" && "hidden"
        )}
      >
        <PreviewCard
          eyebrow="Rendered from live template"
          title="Branded report email"
          description="This preview uses the same report email template that powers scheduled and manual sends."
          contentClassName={variant === "dialog" ? "flex justify-center p-5" : "flex justify-center"}
        >
          <HtmlTemplatePreview
            html={emailHtml}
            title="Report email preview"
            width={760}
            height={1220}
            scale={previewScales.email}
            className="rounded-[1.2rem]"
            iframeClassName="rounded-[1.2rem]"
          />
        </PreviewCard>
      </TabsContent>
    </Tabs>
  );
}
