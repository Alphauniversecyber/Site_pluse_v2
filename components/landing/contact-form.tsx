"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useUser } from "@/hooks/useUser";
import { fetchJson } from "@/lib/api-client";
import { contactMessageSchema } from "@/lib/validation";

const CONTACT_SUBJECTS = [
  "Sales & Partnerships",
  "Billing & Account",
  "Technical Support",
  "Privacy & Data Request",
  "Other"
] as const;

const contactCards = [
  {
    title: "Sales and partnerships",
    detail:
      "Talk through agency fit, rollout plans, and how to position SitePulse inside your service stack."
  },
  {
    title: "Privacy and data requests",
    detail:
      "Use the form below for account data access, deletion requests, or any privacy-related question."
  }
] as const;

type ContactFormValues = {
  name: string;
  email: string;
  subject: (typeof CONTACT_SUBJECTS)[number];
  message: string;
};

export function ContactForm() {
  const { user } = useUser();
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const form = useForm({
    resolver: zodResolver(contactMessageSchema),
    mode: "onChange",
    defaultValues: {
      name: "",
      email: "",
      subject: "Sales & Partnerships",
      message: ""
    }
  });

  useEffect(() => {
    if (!user) {
      return;
    }

    if (!form.getValues("name")) {
      form.setValue("name", user.full_name ?? "", { shouldValidate: false });
    }

    if (!form.getValues("email")) {
      form.setValue("email", user.email ?? "", { shouldValidate: false });
    }
  }, [form, user]);

  if (submitted) {
    return (
      <Card className="mt-10 border-border/80">
        <CardContent className="flex flex-col gap-4 px-6 py-10 text-center">
          <Badge className="mx-auto">Message sent</Badge>
          <h2 className="font-display text-3xl font-semibold tracking-tight">
            We&apos;ve received your message.
          </h2>
          <p className="mx-auto max-w-2xl text-base leading-7 text-muted-foreground">
            We&apos;ll get back to you within 24 hours.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="mt-10 grid gap-6 md:grid-cols-2">
        {contactCards.map((card) => (
          <Card key={card.title} className="border-border/80">
            <CardHeader>
              <CardTitle>{card.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-7 text-muted-foreground">{card.detail}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-10 border-border/80">
        <CardHeader>
          <CardTitle>Send us a message</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-6"
            onSubmit={form.handleSubmit(async (values: ContactFormValues) => {
              setSaving(true);
              try {
                await fetchJson("/api/contact", {
                  method: "POST",
                  body: JSON.stringify(values)
                });
                setSubmitted(true);
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Unable to send your message.");
              } finally {
                setSaving(false);
              }
            })}
          >
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="contact-name">Name</Label>
                <Input
                  id="contact-name"
                  aria-invalid={Boolean(form.formState.errors.name)}
                  {...form.register("name")}
                />
                {form.formState.errors.name ? (
                  <p className="text-sm text-rose-400">{form.formState.errors.name.message}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact-email">Email</Label>
                <Input
                  id="contact-email"
                  type="email"
                  aria-invalid={Boolean(form.formState.errors.email)}
                  {...form.register("email")}
                />
                {form.formState.errors.email ? (
                  <p className="text-sm text-rose-400">{form.formState.errors.email.message}</p>
                ) : null}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact-subject">Subject</Label>
              <Controller
                control={form.control}
                name="subject"
                render={({
                  field
                }: {
                  field: {
                    value: ContactFormValues["subject"];
                    onChange: (value: ContactFormValues["subject"]) => void;
                  };
                }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="contact-subject" aria-invalid={Boolean(form.formState.errors.subject)}>
                      <SelectValue placeholder="Choose a subject" />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTACT_SUBJECTS.map((subject) => (
                        <SelectItem key={subject} value={subject}>
                          {subject}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.subject ? (
                <p className="text-sm text-rose-400">{form.formState.errors.subject.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact-message">Message</Label>
              <Textarea
                id="contact-message"
                className="min-h-[180px]"
                aria-invalid={Boolean(form.formState.errors.message)}
                {...form.register("message")}
              />
              {form.formState.errors.message ? (
                <p className="text-sm text-rose-400">{form.formState.errors.message.message}</p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Share as much detail as you can so we can route this quickly.
                </p>
              )}
            </div>

            <div className="flex justify-start">
              <Button type="submit" disabled={saving}>
                {saving ? "Sending..." : "Send Message"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
