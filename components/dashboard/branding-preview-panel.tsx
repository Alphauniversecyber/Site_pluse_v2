"use client";

import { useMemo, type ReactNode } from "react";

import { HtmlTemplatePreview } from "@/components/shared/html-template-preview";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { buildPreviewEmailHtml, buildPreviewReportHtml } from "@/lib/report-preview-data";

type BrandingPreviewPanelProps = {
  agencyName: string;
  brandColor: string;
  emailFromName: string;
  logoUrl?: string | null;
  replyToEmail?: string | null;
  agencyWebsiteUrl?: string | null;
  reportFooterText?: string | null;
};

function PreviewCard({
  eyebrow,
  title,
  description,
  children
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[2rem] border border-slate-200 bg-slate-100 p-4 shadow-[0_26px_60px_-42px_rgba(15,23,42,0.35)]">
      <div className="overflow-hidden rounded-[1.65rem] border border-slate-200 bg-white shadow-[0_24px_60px_-40px_rgba(15,23,42,0.28)]">
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">{eyebrow}</p>
          <h3 className="mt-2 text-lg font-semibold tracking-tight text-slate-900">{title}</h3>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        <div className="pointer-events-none bg-slate-100/90 p-4">{children}</div>
      </div>
    </div>
  );
}

export function BrandingPreviewPanel(props: BrandingPreviewPanelProps) {
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

  return (
    <Tabs defaultValue="pdf" className="space-y-4">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="pdf">PDF Report preview</TabsTrigger>
        <TabsTrigger value="email">Email preview</TabsTrigger>
      </TabsList>

      <TabsContent value="pdf" className="mt-0">
        <PreviewCard
          eyebrow="Rendered from live template"
          title="Branded PDF report"
          description="This preview uses the same HTML report template the dashboard PDF generator uses."
        >
          <HtmlTemplatePreview
            html={reportHtml}
            title="PDF report preview"
            width={920}
            height={1280}
            scale={0.46}
            className="rounded-[1.2rem]"
            iframeClassName="rounded-[1.2rem]"
          />
        </PreviewCard>
      </TabsContent>

      <TabsContent value="email" className="mt-0">
        <PreviewCard
          eyebrow="Rendered from live template"
          title="Branded report email"
          description="This preview uses the same report email template that powers scheduled and manual sends."
        >
          <HtmlTemplatePreview
            html={emailHtml}
            title="Report email preview"
            width={760}
            height={1220}
            scale={0.58}
            className="rounded-[1.2rem]"
            iframeClassName="rounded-[1.2rem]"
          />
        </PreviewCard>
      </TabsContent>
    </Tabs>
  );
}
