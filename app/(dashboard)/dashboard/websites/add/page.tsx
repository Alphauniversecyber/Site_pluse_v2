"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { EmptyState } from "@/components/dashboard/empty-state";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useWorkspace } from "@/hooks/useWorkspace";
import { fetchJson } from "@/lib/api-client";
import { markOnboardingStepComplete } from "@/lib/onboarding";
import { websiteSchema } from "@/lib/validation";
import type { Website } from "@/types";

export default function AddWebsitePage() {
  const router = useRouter();
  const workspace = useWorkspace();
  const [submitting, setSubmitting] = useState(false);
  const [competitorText, setCompetitorText] = useState("");
  const form = useForm({
    resolver: zodResolver(websiteSchema),
    defaultValues: {
      url: "",
      label: ""
    }
  });

  if (workspace.activeWorkspace.role === "viewer") {
    return (
      <EmptyState
        title="Viewer access is read-only"
        description="Switch to a workspace you own or have admin access to before adding websites."
        actionLabel="Back to websites"
        actionHref="/dashboard/websites"
      />
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Add website"
        title="Add a client website to SitePulse"
        description="Paste the URL, give it a name, and SitePulse will start it with weekly reports and email alerts enabled for that site."
      />

      <Card className="max-w-[960px] xl:max-w-[1080px] 2xl:max-w-[1200px] min-[1800px]:max-w-[1320px]">
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
                    competitor_urls: competitorText
                      .split(/[\n,]+/)
                      .map((item) => item.trim())
                      .filter(Boolean)
                      .slice(0, 3)
                  })
                });
                markOnboardingStepComplete(0);
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
              <Label htmlFor="competitor-urls">Competitor URLs</Label>
              <Textarea
                id="competitor-urls"
                placeholder="https://competitor-one.com, https://competitor-two.com"
                value={competitorText}
                onChange={(event) => setCompetitorText(event.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                Optional. Add up to 3 competitor URLs separated by commas or new lines for daily comparison tracking.
              </p>
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
