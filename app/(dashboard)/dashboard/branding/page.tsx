"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { LogoPreview } from "@/components/brand/logo-preview";
import { EmptyState } from "@/components/dashboard/empty-state";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { buildStoragePath } from "@/lib/utils";
import { brandingSchema } from "@/lib/validation";
import { fetchJson } from "@/lib/api-client";
import { useBranding } from "@/hooks/useBranding";
import { useUser } from "@/hooks/useUser";

export default function BrandingPage() {
  const { user, loading: userLoading } = useUser();
  const { branding, loading, refetch } = useBranding();
  const [saving, setSaving] = useState(false);
  const form = useForm({
    resolver: zodResolver(brandingSchema),
    mode: "onChange",
    defaultValues: {
      agency_name: "",
      brand_color: "#3B82F6",
      email_from_name: "",
      logo_url: ""
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
      logo_url: branding.logo_url ?? ""
    });
  }, [branding, form]);

  const uploadLogo = async (file: File) => {
    if (!user) {
      return;
    }

    const supabase = createSupabaseBrowserClient();
    const path = buildStoragePath(user.id, file.name);
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

  if (user.plan !== "agency") {
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
            <div className="rounded-[2rem] border border-border bg-background p-4 sm:p-6">
              <div className="overflow-hidden rounded-[1.75rem] border border-border bg-white shadow-[0_24px_60px_-36px_rgba(15,23,42,0.45)]" style={{ borderColor: form.watch("brand_color") }}>
                <div className="bg-card px-5 py-5">
                  <LogoPreview
                    src={form.watch("logo_url")}
                    alt={`${form.watch("agency_name") || "Agency"} logo`}
                    fallbackTitle="Your logo will appear here"
                    fallbackBody="Upload a PNG, JPG, SVG, or ICO to preview branded reports."
                    className="min-h-[84px] border-white/10 bg-white/5"
                    imageClassName="max-h-14"
                  />
                </div>

                <div className="space-y-6 px-5 py-6 text-slate-900">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Weekly report preview</p>
                    <h3 className="mt-3 font-display text-3xl font-semibold">{form.watch("agency_name") || "Your Agency"}</h3>
                    <p className="mt-2 text-slate-500">
                      Sent from {form.watch("email_from_name") || "Your team"} to clients and stakeholders.
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      ["Performance", "91"],
                      ["Accessibility", "88"],
                      ["SEO", "94"],
                      ["Best Practices", "90"]
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</p>
                        <p className="mt-2 text-2xl font-semibold">{value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                    Branded PDFs and weekly emails keep your agency front and center without clipping, stretching, or awkward logo cropping.
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
