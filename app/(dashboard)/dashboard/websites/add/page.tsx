"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fetchJson } from "@/lib/api-client";
import { websiteSchema } from "@/lib/validation";
import type { Website } from "@/types";

export default function AddWebsitePage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [recipientText, setRecipientText] = useState("");
  const form = useForm({
    resolver: zodResolver(websiteSchema),
    defaultValues: {
      url: "",
      label: "",
      email_reports_enabled: false
    }
  });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Add website"
        title="Add a client website to SitePulse"
        description="Paste the URL, give it a name, and choose whether reports should go out automatically for this site."
      />

      <Card className="max-w-3xl">
        <CardContent className="p-6">
          <form
            className="space-y-6"
            onSubmit={form.handleSubmit(async (values: any) => {
              setSubmitting(true);
              try {
                await fetchJson<Website>("/api/websites", {
                  method: "POST",
                  body: JSON.stringify({
                    ...values,
                    report_recipients: recipientText
                      .split(",")
                      .map((item) => item.trim())
                      .filter(Boolean)
                  })
                });
                toast.success("Website added.");
                router.push("/dashboard/websites");
                router.refresh();
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Unable to add website.");
              } finally {
                setSubmitting(false);
              }
            })}
          >
            <div className="space-y-2">
              <Label htmlFor="site-url">Website URL</Label>
              <Input id="site-url" placeholder="https://clientsite.com" {...form.register("url")} />
              <p className="text-sm text-rose-400">{form.formState.errors.url?.message}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="site-label">Client / site name</Label>
              <Input id="site-label" placeholder="Acme Studio" {...form.register("label")} />
              <p className="text-sm text-rose-400">{form.formState.errors.label?.message}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="site-recipients">Additional report recipients</Label>
              <Textarea
                id="site-recipients"
                placeholder="client@example.com, marketing@example.com"
                value={recipientText}
                onChange={(event) => setRecipientText(event.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                Separate multiple emails with commas. These addresses receive automatic reports for this site.
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-border bg-background p-4">
              <input
                id="site-email-reports"
                type="checkbox"
                className="h-4 w-4 rounded border-border bg-background"
                checked={form.watch("email_reports_enabled")}
                onChange={(event) => form.setValue("email_reports_enabled", event.target.checked)}
              />
              <Label htmlFor="site-email-reports">Enable automatic email reports for this site</Label>
            </div>
            <div className="flex gap-3">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Adding website..." : "Save website"}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
