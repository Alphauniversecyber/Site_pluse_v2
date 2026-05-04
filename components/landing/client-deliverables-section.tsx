import { EmailReportPreview } from "@/components/landing/email-report-preview";
import { PdfReportPreview } from "@/components/landing/pdf-report-preview";

export function ClientDeliverablesSection() {
  return (
    <section className="border-y border-border bg-muted/20">
      <div className="container py-16 md:py-20">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
          What your client receives
        </p>
        <h2 className="mt-4 font-display text-4xl font-semibold">
          Show the deliverable before the prospect signs.
        </h2>
        <p className="mt-4 max-w-3xl text-lg leading-8 text-muted-foreground">
          Prospects can see the exact reporting experience: a branded PDF they can save and a weekly email that keeps your agency visible between meetings.
        </p>

        <div className="mt-10 grid gap-8 xl:grid-cols-2 xl:items-start">
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-sm font-semibold text-foreground">PDF Report</p>
              <p className="mt-1 text-sm leading-7 text-muted-foreground">
                A branded PDF they can keep.
              </p>
            </div>
            <PdfReportPreview compact />
          </div>

          <div className="flex flex-col gap-4">
            <div>
              <p className="text-sm font-semibold text-foreground">Email Report</p>
              <p className="mt-1 text-sm leading-7 text-muted-foreground">
                A weekly email that keeps you top of mind.
              </p>
            </div>
            <EmailReportPreview compact />
          </div>
        </div>
      </div>
    </section>
  );
}
