"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type BrandingPreviewPanelProps = {
  agencyName: string;
  brandColor: string;
  emailFromName: string;
  logoUrl?: string | null;
  replyToEmail?: string | null;
  agencyWebsiteUrl?: string | null;
  reportFooterText?: string | null;
};

function PreviewLogo({
  logoUrl,
  agencyName,
  dark = false,
  className
}: {
  logoUrl?: string | null;
  agencyName: string;
  dark?: boolean;
  className?: string;
}) {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={`${agencyName} logo`}
        className={cn("block max-h-full max-w-full object-contain object-left", dark ? "brightness-0 invert" : "", className)}
      />
    );
  }

  return (
    <span className={cn("font-semibold tracking-tight", dark ? "text-white" : "text-slate-900", className)}>
      {agencyName}
    </span>
  );
}

function PdfPreviewCard({
  agencyName,
  brandColor,
  logoUrl,
  replyToEmail,
  agencyWebsiteUrl,
  reportFooterText
}: BrandingPreviewPanelProps) {
  const footerEmail = replyToEmail?.trim() || "hello@agency.com";

  return (
    <div className="rounded-[2rem] border border-slate-200 bg-slate-100 p-4 shadow-[0_26px_60px_-42px_rgba(15,23,42,0.35)]">
      <div className="overflow-hidden rounded-[1.65rem] border border-slate-200 bg-white shadow-[0_24px_60px_-40px_rgba(15,23,42,0.28)]">
        <div className="h-2.5 w-full" style={{ backgroundColor: brandColor }} />
        <div className="bg-slate-950 px-5 py-5 text-white">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex h-11 items-center">
                <PreviewLogo agencyName={agencyName} logoUrl={logoUrl} dark className="max-h-9 max-w-[9rem]" />
              </div>
              <p className="mt-3 text-[11px] uppercase tracking-[0.22em] text-slate-400">Executive Summary</p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-white">Monthly Website Report</h3>
              <p className="mt-2 text-sm font-semibold text-sky-300">sampleclientsite.com</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-right">
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">Prepared by</p>
              <p className="mt-1 text-sm font-semibold text-white">{agencyName}</p>
            </div>
          </div>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">Overall Score</p>
                <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                  91
                  <span className="ml-1 text-base text-slate-500">/100</span>
                </p>
              </div>
              <span className="rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ borderColor: brandColor, color: brandColor }}>
                Excellent
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              ["Performance", "91"],
              ["SEO", "94"],
              ["Accessibility", "88"],
              ["Best Practices", "90"]
            ].map(([label, value]) => (
              <div key={label} className="rounded-[1.2rem] border border-slate-200 bg-white p-3">
                <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">{label}</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full rounded-full" style={{ width: `${value}%`, backgroundColor: brandColor }} />
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-[1.2rem] border border-slate-200 bg-white p-4">
            <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">Footer</p>
            <div className="mt-3 h-px bg-slate-200" />
            <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-500">
              <span>{agencyName}</span>
              <span>{footerEmail}</span>
              <span>Page 1 of 13</span>
            </div>
            {agencyWebsiteUrl ? <p className="mt-2 truncate text-center text-[11px] text-slate-500">{agencyWebsiteUrl}</p> : null}
            {reportFooterText ? <p className="mt-1 text-center text-[11px] text-slate-500">{reportFooterText}</p> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmailPreviewCard({
  agencyName,
  brandColor,
  emailFromName,
  logoUrl,
  replyToEmail
}: BrandingPreviewPanelProps) {
  return (
    <div className="rounded-[2rem] border border-slate-200 bg-slate-100 p-4 shadow-[0_26px_60px_-42px_rgba(15,23,42,0.35)]">
      <div className="overflow-hidden rounded-[1.65rem] border border-slate-200 bg-white shadow-[0_24px_60px_-40px_rgba(15,23,42,0.28)]">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-slate-500">From: {emailFromName}</p>
              <p className="mt-1 text-xs text-slate-400">Reply-to: {replyToEmail?.trim() || "default sender address"}</p>
            </div>
            <div className="rounded-full bg-white px-4 py-1.5 text-xs text-slate-500 shadow-sm">Monthly Website Report</div>
          </div>
        </div>

        <div className="bg-slate-950 px-5 py-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 items-center">
                <PreviewLogo agencyName={agencyName} logoUrl={logoUrl} dark className="max-h-8 max-w-[8.5rem]" />
              </div>
              <span className="text-lg font-semibold text-white">{agencyName}</span>
            </div>
            <span className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Automated monthly report</span>
          </div>
          <div className="mt-4 h-1 w-full rounded-full" style={{ backgroundColor: brandColor }} />
        </div>

        <div className="space-y-5 px-5 py-5">
          <div className="rounded-[1.35rem] border border-slate-200 bg-white p-5">
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Monthly website report</p>
            <h3 className="mt-3 text-[1.7rem] font-semibold tracking-tight text-slate-900">Monthly Website Report for Sample Client Site</h3>
            <p className="mt-2 text-sm font-semibold text-blue-600">sampleclientsite.com</p>
            <p className="mt-2 text-xs text-slate-400">May 3, 2026</p>

            <div className="mt-5 rounded-[1.1rem] border-l-4 bg-blue-50 p-4" style={{ borderLeftColor: brandColor }}>
              <p className="text-[10px] uppercase tracking-[0.18em]" style={{ color: brandColor }}>Why this matters now</p>
              <p className="mt-2 text-sm font-medium text-slate-800">Performance and search visibility are already strong, with a few fixes left to tighten the client experience.</p>
              <p className="mt-2 text-sm text-slate-600">The attached report highlights the clearest next actions and score changes from the latest scan.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              ["Performance", "91"],
              ["SEO", "94"],
              ["Accessibility", "88"],
              ["Best Practices", "90"]
            ].map(([label, value]) => (
              <div key={label} className="rounded-[1.15rem] border border-slate-200 bg-slate-50 p-3">
                <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">{label}</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-cyan-400" style={{ width: `${value}%` }} />
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-[1.2rem] border border-slate-200 bg-slate-50 p-4">
            <div className="h-px bg-slate-200" />
            <div className="pt-4 text-center">
              <p className="text-sm text-slate-500">{agencyName}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function BrandingPreviewPanel(props: BrandingPreviewPanelProps) {
  return (
    <Tabs defaultValue="pdf" className="space-y-4">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="pdf">PDF Report preview</TabsTrigger>
        <TabsTrigger value="email">Email preview</TabsTrigger>
      </TabsList>

      <TabsContent value="pdf" className="mt-0">
        <PdfPreviewCard {...props} />
      </TabsContent>

      <TabsContent value="email" className="mt-0">
        <EmailPreviewCard {...props} />
      </TabsContent>
    </Tabs>
  );
}
