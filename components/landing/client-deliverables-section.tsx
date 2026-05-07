import { EmailReportPreview } from "@/components/landing/email-report-preview";
import { PdfReportPreview } from "@/components/landing/pdf-report-preview";

const deliverables = [
  {
    eyebrow: "Proposal leave-behind",
    title: "Branded PDF report",
    description: "Give prospects something polished they can save, forward, and revisit after the meeting."
  },
  {
    eyebrow: "Retention touchpoint",
    title: "Weekly email report",
    description: "Keep your agency present between calls with updates that look useful instead of automated."
  }
] as const;

export function ClientDeliverablesSection() {
  return (
    <section className="border-b border-slate-200/80 bg-[#f4f8ff] dark:border-white/10 dark:bg-[#0b1424]">
      <div className="container py-16 md:py-20">
        <div className="grid gap-8 xl:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)] xl:items-end">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-700 dark:text-blue-200">
              Client deliverables
            </p>
            <h2 className="mt-4 font-display text-[2.2rem] font-semibold leading-tight text-slate-950 dark:text-white md:text-[2.8rem]">
              Show the deliverable before the prospect signs.
            </h2>
          </div>
          <p className="max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300 md:text-lg md:leading-8 xl:justify-self-end">
            One section, two clear jobs: the PDF helps you recap the opportunity after the call, and the email keeps your agency visible after the work starts.
          </p>
        </div>

        <div className="mt-12 grid gap-6 xl:grid-cols-2 xl:items-stretch">
          <div className="flex h-full min-h-[600px] flex-col overflow-hidden rounded-[1.9rem] border border-slate-200 bg-white/88 p-4 shadow-[0_28px_80px_-54px_rgba(15,23,42,0.16)] dark:border-white/10 dark:bg-white/[0.03] dark:shadow-[0_28px_80px_-54px_rgba(2,6,23,0.95)] sm:p-5">
            <div className="px-1 pb-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-700 dark:text-blue-200">
                {deliverables[0].eyebrow}
              </p>
              <h3 className="mt-3 text-xl font-semibold text-slate-950 dark:text-white sm:text-2xl">
                {deliverables[0].title}
              </h3>
              <p className="mt-2 max-w-xl text-sm leading-7 text-slate-500 dark:text-slate-400 sm:text-base">
                {deliverables[0].description}
              </p>
            </div>
            <div className="flex flex-1 flex-row items-stretch gap-6 overflow-hidden rounded-[1.7rem] border border-slate-200 bg-[#eef4ff] p-2 dark:border-white/8 dark:bg-[#101a2f] sm:p-3">
              <PdfReportPreview compact />
            </div>
          </div>

          <div className="flex h-full min-h-[600px] flex-col overflow-hidden rounded-[1.9rem] border border-slate-200 bg-white/88 p-4 shadow-[0_28px_80px_-54px_rgba(15,23,42,0.16)] dark:border-white/10 dark:bg-white/[0.03] dark:shadow-[0_28px_80px_-54px_rgba(2,6,23,0.95)] sm:p-5">
            <div className="px-1 pb-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-700 dark:text-blue-200">
                {deliverables[1].eyebrow}
              </p>
              <h3 className="mt-3 text-xl font-semibold text-slate-950 dark:text-white sm:text-2xl">
                {deliverables[1].title}
              </h3>
              <p className="mt-2 max-w-xl text-sm leading-7 text-slate-500 dark:text-slate-400 sm:text-base">
                {deliverables[1].description}
              </p>
            </div>
            <div className="flex flex-1 flex-row items-stretch gap-6 overflow-hidden rounded-[1.7rem] border border-slate-200 bg-[#eef4ff] p-2 dark:border-white/8 dark:bg-[#101a2f] sm:p-3">
              <EmailReportPreview compact />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
