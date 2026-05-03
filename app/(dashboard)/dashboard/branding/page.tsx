"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { BrandingPreviewPanel } from "@/components/dashboard/branding-preview-panel";
import { EmptyState } from "@/components/dashboard/empty-state";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { isTrialActive } from "@/lib/trial";
import { buildStoragePath } from "@/lib/utils";
import { brandingSchema } from "@/lib/validation";
import { fetchJson } from "@/lib/api-client";
import { useBranding } from "@/hooks/useBranding";
import { useUser } from "@/hooks/useUser";
import { useWorkspace } from "@/hooks/useWorkspace";

export default function BrandingPage() {
  const { user, loading: userLoading } = useUser();
  const workspace = useWorkspace();
  const { branding, loading, refetch } = useBranding();
  const [saving, setSaving] = useState(false);
  const form = useForm({
    resolver: zodResolver(brandingSchema),
    mode: "onChange",
    defaultValues: {
      agency_name: "",
      brand_color: "#3B82F6",
      email_from_name: "",
      logo_url: "",
      reply_to_email: "",
      agency_website_url: "",
      report_footer_text: ""
    }
  });

  useEffect(() => {
    if (!branding) {
      return;
    }

    form.reset({
      agency_name: branding.agency_name,
      brand_color: branding.brand_color,
      email_from_name: branding.email_from_name ?? branding.agency_name,
      logo_url: branding.logo_url ?? "",
      reply_to_email: branding.reply_to_email ?? "",
      agency_website_url: branding.agency_website_url ?? "",
      report_footer_text: branding.report_footer_text ?? ""
    });
  }, [branding, form]);

  const previewValues = form.watch();

  const uploadLogo = async (file: File) => {
    if (!user) {
      return;
    }

    const supabase = createSupabaseBrowserClient();
    const path = buildStoragePath(workspace.workspaceProfile.id, file.name);
    const { error } = await supabase.storage.from("branding-assets").upload(path, file, {
      upsert: true
    });

    if (error) {
      throw error;
    }

    const { data } = supabase.storage.from("branding-assets").getPublicUrl(path);
    form.setValue("logo_url", data.publicUrl);
    toast.success("Logo uploaded.");
  };

  if (userLoading || loading) {
    return <p className="text-muted-foreground">Loading branding...</p>;
  }

  if (!user) {
    return (
      <EmptyState
        title="Unable to load account"
        description="We couldn't find your user account."
      />
    );
  }

  if (workspace.activeWorkspace.role === "viewer") {
    return (
      <EmptyState
        title="Viewer access is read-only"
        description="Switch to a workspace you own or have admin access to before editing branding."
        actionLabel="Back to dashboard"
        actionHref="/dashboard"
      />
    );
  }

  if (workspace.workspaceProfile.plan !== "agency" && !isTrialActive(workspace.workspaceProfile)) {
    return (
      <EmptyState
        title="White-label branding is on the Agency plan"
        description="Upgrade to Agency to add your logo, custom brand color, and custom email from name to every client report."
        actionLabel="Upgrade in billing"
        actionHref="/dashboard/billing"
      />
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Branding"
        title="White-label branding"
        description="Upload your agency logo, set a brand color, customize report sender details, and preview how client-facing reports will look."
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_0.92fr] min-[1800px]:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader>
            <CardTitle>Brand settings</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-6"
              onSubmit={form.handleSubmit(async (values: any) => {
                setSaving(true);
                try {
                  await fetchJson("/api/branding", {
                    method: "PUT",
                    body: JSON.stringify(values)
                  });
                  toast.success("Branding updated.");
                  await refetch();
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Unable to save branding.");
                } finally {
                  setSaving(false);
                }
              })}
            >
              <div className="space-y-2">
                <Label htmlFor="agency-name">Agency name</Label>
                <Input id="agency-name" aria-invalid={Boolean(form.formState.errors.agency_name)} {...form.register("agency_name")} />
                {form.formState.errors.agency_name ? (
                  <p className="text-sm text-rose-400">{form.formState.errors.agency_name.message}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Shown on PDF reports and branded email previews.</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="brand-color">Brand color</Label>
                <div className="flex gap-3">
                  <Input id="brand-color" type="color" className="h-11 w-20 p-1" {...form.register("brand_color")} />
                  <Input value={form.watch("brand_color")} onChange={(event) => form.setValue("brand_color", event.target.value)} />
                </div>
                {form.formState.errors.brand_color ? (
                  <p className="text-sm text-rose-400">{form.formState.errors.brand_color.message}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="email-from-name">Email from name</Label>
                <Input id="email-from-name" aria-invalid={Boolean(form.formState.errors.email_from_name)} {...form.register("email_from_name")} />
                {form.formState.errors.email_from_name ? (
                  <p className="text-sm text-rose-400">{form.formState.errors.email_from_name.message}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Used as the visible sender name for client report emails.</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="reply-to-email">Reply-to email</Label>
                <Input id="reply-to-email" type="email" aria-invalid={Boolean(form.formState.errors.reply_to_email)} {...form.register("reply_to_email")} />
                {form.formState.errors.reply_to_email ? (
                  <p className="text-sm text-rose-400">{form.formState.errors.reply_to_email.message}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Clients who reply to report emails will reach this address instead of SitePulse.</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="logo-url">Logo URL</Label>
                <Input id="logo-url" aria-invalid={Boolean(form.formState.errors.logo_url)} {...form.register("logo_url")} />
                {form.formState.errors.logo_url ? (
                  <p className="text-sm text-rose-400">{form.formState.errors.logo_url.message}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Paste a PNG, JPG, SVG, or ICO file URL if you host assets elsewhere.</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="logo-upload">Or upload a logo</Label>
                <Input
                  id="logo-upload"
                  type="file"
                  accept="image/*,.svg,.png,.jpg,.jpeg,.ico"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      void uploadLogo(file);
                    }
                  }}
                />
                <p className="text-sm text-muted-foreground">
                  Horizontal and square logos are both supported. Previews use contain mode so nothing gets cropped.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="agency-website-url">Agency website URL</Label>
                <Input id="agency-website-url" type="url" aria-invalid={Boolean(form.formState.errors.agency_website_url)} {...form.register("agency_website_url")} />
                {form.formState.errors.agency_website_url ? (
                  <p className="text-sm text-rose-400">{form.formState.errors.agency_website_url.message}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Shown in the PDF report footer so clients can find your agency.</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="report-footer-text">Report footer text</Label>
                <Textarea
                  id="report-footer-text"
                  maxLength={200}
                  aria-invalid={Boolean(form.formState.errors.report_footer_text)}
                  {...form.register("report_footer_text")}
                />
                {form.formState.errors.report_footer_text ? (
                  <p className="text-sm text-rose-400">{form.formState.errors.report_footer_text.message}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Custom message shown at the bottom of every PDF report.</p>
                )}
              </div>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save branding"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Report preview</CardTitle>
          </CardHeader>
          <CardContent>
            <BrandingPreviewPanel
              agencyName={previewValues.agency_name || "Your Agency"}
              brandColor={previewValues.brand_color || "#3B82F6"}
              emailFromName={previewValues.email_from_name || previewValues.agency_name || "Your Agency"}
              logoUrl={previewValues.logo_url || ""}
              replyToEmail={previewValues.reply_to_email || ""}
              agencyWebsiteUrl={previewValues.agency_website_url || ""}
              reportFooterText={previewValues.report_footer_text || ""}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
