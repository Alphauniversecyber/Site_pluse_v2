"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { EmptyState } from "@/components/dashboard/empty-state";
import { PageHeader } from "@/components/dashboard/page-header";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { buildStoragePath } from "@/lib/utils";
import { settingsSchema } from "@/lib/validation";
import { fetchJson } from "@/lib/api-client";
import { useUser } from "@/hooks/useUser";
import type { TeamMember } from "@/types";

export default function SettingsPage() {
  const { user, loading, refetch } = useUser();
  const [saving, setSaving] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "viewer">("viewer");
  const form = useForm({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      full_name: "",
      email: "",
      password: "",
      email_report_frequency: "weekly" as const,
      email_reports_enabled: false,
      email_notifications_enabled: true,
      profile_photo_url: "",
      extra_report_recipients: []
    }
  });

  useEffect(() => {
    if (!user) {
      return;
    }

    form.reset({
      full_name: user.full_name ?? "",
      email: user.email,
      password: "",
      email_report_frequency: user.email_report_frequency,
      email_reports_enabled: user.email_reports_enabled,
      email_notifications_enabled: user.email_notifications_enabled,
      profile_photo_url: user.profile_photo_url ?? "",
      extra_report_recipients: user.extra_report_recipients ?? []
    });
  }, [form, user]);

  useEffect(() => {
    if (!user || user.plan !== "agency") {
      return;
    }

    void fetchJson<TeamMember[]>("/api/team")
      .then(setTeamMembers)
      .catch(() => {
        setTeamMembers([]);
      });
  }, [user]);

  const uploadProfilePhoto = async (file: File) => {
    if (!user) {
      return;
    }

    const supabase = createSupabaseBrowserClient();
    const path = buildStoragePath(user.id, file.name);
    const { error } = await supabase.storage.from("profile-assets").upload(path, file, {
      upsert: true
    });

    if (error) {
      throw error;
    }

    const { data } = supabase.storage.from("profile-assets").getPublicUrl(path);
    form.setValue("profile_photo_url", data.publicUrl);
    toast.success("Profile photo uploaded.");
  };

  if (loading) {
    return <p className="text-muted-foreground">Loading settings...</p>;
  }

  if (!user) {
    return (
      <EmptyState
        title="Unable to load settings"
        description="We couldn&apos;t find your profile. Try refreshing the page."
      />
    );
  }

  return (
    <div className="max-w-[1240px] space-y-8 xl:max-w-[1360px] 2xl:max-w-[1480px] min-[1800px]:max-w-[1600px] min-[2200px]:max-w-[1720px]">
      <PageHeader
        eyebrow="Settings"
        title="Account settings"
        description="Update profile details, report delivery defaults, password, notifications, and account access."
      />

      <Card>
        <CardContent className="p-6">
          <form
            className="space-y-6"
            onSubmit={form.handleSubmit(async (values: any) => {
              setSaving(true);
              try {
                await fetchJson("/api/user/settings", {
                  method: "PUT",
                  body: JSON.stringify({
                    ...values,
                    extra_report_recipients:
                      typeof values.extra_report_recipients === "string"
                        ? values.extra_report_recipients
                            .split(",")
                            .map((item: string) => item.trim())
                            .filter(Boolean)
                        : values.extra_report_recipients
                  })
                });
                toast.success("Settings updated.");
                await refetch();
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Unable to save settings.");
              } finally {
                setSaving(false);
              }
            })}
          >
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="full-name">Full name</Label>
                <Input id="full-name" aria-invalid={Boolean(form.formState.errors.full_name)} {...form.register("full_name")} />
                <p className="text-sm text-muted-foreground">Used across your workspace and report sender details.</p>
                {form.formState.errors.full_name ? (
                  <p className="text-sm text-rose-400">{form.formState.errors.full_name.message}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" aria-invalid={Boolean(form.formState.errors.email)} {...form.register("email")} />
                <p className="text-sm text-muted-foreground">This email receives billing updates and product alerts.</p>
                {form.formState.errors.email ? (
                  <p className="text-sm text-rose-400">{form.formState.errors.email.message}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Change password</Label>
                <PasswordInput
                  id="password"
                  placeholder="Leave blank to keep current password"
                  aria-invalid={Boolean(form.formState.errors.password)}
                  {...form.register("password")}
                />
                <p className="text-sm text-muted-foreground">Leave blank unless you want to replace your current password.</p>
                {form.formState.errors.password ? (
                  <p className="text-sm text-rose-400">{form.formState.errors.password.message}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label>Report frequency</Label>
                <Select
                  value={form.watch("email_report_frequency")}
                  onValueChange={(value) => form.setValue("email_report_frequency", value as "daily" | "weekly" | "monthly")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="extra-recipients">Extra report recipients</Label>
              <Textarea
                id="extra-recipients"
                placeholder="client@example.com, owner@example.com"
                value={
                  Array.isArray(form.watch("extra_report_recipients"))
                    ? form.watch("extra_report_recipients").join(", ")
                    : ""
                }
                onChange={(event) =>
                  form.setValue(
                    "extra_report_recipients",
                    event.target.value
                      .split(",")
                      .map((item: string) => item.trim())
                    .filter(Boolean)
                  )
                }
              />
              <p className="text-sm text-muted-foreground">
                Add comma-separated client or stakeholder emails for scheduled reports.
              </p>
            </div>

            <div className="space-y-3 rounded-3xl border border-border bg-background p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium">Automatic email reports</p>
                  <p className="text-sm text-muted-foreground">Send scheduled reports to you automatically.</p>
                </div>
                <Switch
                  checked={form.watch("email_reports_enabled")}
                  onCheckedChange={(value) => form.setValue("email_reports_enabled", value)}
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium">Email notifications</p>
                  <p className="text-sm text-muted-foreground">Get alerted when scores drop or scans fail.</p>
                </div>
                <Switch
                  checked={form.watch("email_notifications_enabled")}
                  onCheckedChange={(value) => form.setValue("email_notifications_enabled", value)}
                />
              </div>
            </div>

            <div className="space-y-3 rounded-3xl border border-border bg-background p-5">
              <div className="space-y-2">
                <Label htmlFor="profile-photo">Profile photo URL</Label>
                <Input
                  id="profile-photo"
                  aria-invalid={Boolean(form.formState.errors.profile_photo_url)}
                  {...form.register("profile_photo_url")}
                />
                {form.formState.errors.profile_photo_url ? (
                  <p className="text-sm text-rose-400">{form.formState.errors.profile_photo_url.message}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-upload">Or upload a profile photo</Label>
                <Input
                  id="profile-upload"
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      void uploadProfilePhoto(file);
                    }
                  }}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save settings"}
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="destructive">
                    Delete account
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This deletes your login, monitored websites, scans, reports, and branding data permanently.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={async () => {
                        try {
                          await fetchJson("/api/user/settings", { method: "DELETE" });
                          toast.success("Account deleted.");
                          window.location.href = "/";
                        } catch (error) {
                          toast.error(error instanceof Error ? error.message : "Unable to delete account.");
                        }
                      }}
                    >
                      Delete permanently
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </form>
        </CardContent>
      </Card>

      {user.plan === "agency" ? (
        <Card>
          <CardContent className="space-y-6 p-6">
            <div>
              <h2 className="font-display text-2xl font-semibold">Team access</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Agency plan includes up to 3 users total. Invite teammates so they can review scans and reports with you.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-[1fr_180px_auto]">
              <Input value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="teammate@agency.com" />
              <Select value={inviteRole} onValueChange={(value) => setInviteRole(value as "admin" | "viewer")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
              <Button
                disabled={!inviteEmail.trim()}
                onClick={async () => {
                  try {
                    const member = await fetchJson<TeamMember>("/api/team", {
                      method: "POST",
                      body: JSON.stringify({
                        member_email: inviteEmail,
                        role: inviteRole
                      })
                    });
                    setTeamMembers((current) => [member, ...current]);
                    setInviteEmail("");
                    toast.success("Team member invited.");
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Unable to invite team member.");
                  }
                }}
              >
                Invite member
              </Button>
            </div>

            <div className="space-y-3">
              {teamMembers.length ? (
                teamMembers.map((member) => (
                  <div key={member.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-background p-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-medium">{member.member_email}</p>
                      <p className="text-sm text-muted-foreground">
                        {member.role} - {member.status}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={async () => {
                        try {
                          await fetchJson(`/api/team/${member.id}`, { method: "DELETE" });
                          setTeamMembers((current) => current.filter((item) => item.id !== member.id));
                          toast.success("Team member removed.");
                        } catch (error) {
                          toast.error(error instanceof Error ? error.message : "Unable to remove team member.");
                        }
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                ))
              ) : (
                <p className="rounded-2xl border border-border bg-background p-4 text-sm text-muted-foreground">
                  No teammates invited yet.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
