import { z } from "zod";

const urlRegex = /^https?:\/\/.+/i;
const reportFrequencySchema = z.enum(["daily", "weekly", "monthly", "never"]);
const contactSubjectSchema = z.enum([
  "Sales & Partnerships",
  "Billing & Account",
  "Technical Support",
  "Privacy & Data Request",
  "Other"
]);

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters.")
});

export const signupSchema = loginSchema.extend({
  fullName: z.string().min(2, "Full name is required."),
  confirmPassword: z.string().min(8, "Confirm your password.")
}).refine((value) => value.password === value.confirmPassword, {
  message: "Passwords do not match.",
  path: ["confirmPassword"]
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Enter a valid email address.")
});

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string().min(8, "Confirm your password.")
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"]
  });

export const websiteSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1, "Website URL is required.")
    .transform((value) => (urlRegex.test(value) ? value : `https://${value}`))
    .refine((value) => {
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    }, "Enter a valid website URL."),
  label: z.string().trim().min(2, "A website label is required."),
  report_frequency: reportFrequencySchema.optional().default("weekly"),
  extra_recipients: z.array(z.string().email("Use valid email addresses.")).optional().default([]),
  auto_email_reports: z.boolean().optional().default(true),
  email_notifications: z.boolean().optional().default(true),
  competitor_urls: z.array(z.string().url("Use valid competitor URLs.")).max(3, "Add up to 3 competitor URLs only.").optional().default([])
});

export const websiteUpdateSchema = z.object({
  label: z.string().trim().min(2).optional(),
  is_active: z.boolean().optional(),
  frequency: z.enum(["daily", "weekly", "monthly"]).optional(),
  report_frequency: reportFrequencySchema.optional(),
  extra_recipients: z.array(z.string().email()).optional(),
  auto_email_reports: z.boolean().optional(),
  email_notifications: z.boolean().optional(),
  client_dashboard_enabled: z.boolean().optional(),
  client_dashboard_use_branding_logo: z.boolean().optional(),
  competitor_urls: z.array(z.string().url()).max(3).optional()
});

export const scanRunSchema = z.object({
  websiteId: z.string().uuid("Invalid website id."),
  activateSite: z.boolean().optional().default(false)
});

export const previewScanSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1, "Website URL is required.")
    .transform((value) => (urlRegex.test(value) ? value : `https://${value}`))
    .refine((value) => {
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    }, "Enter a valid website URL.")
});

export const authenticatedScanSchema = previewScanSchema;

const websiteSignalScanSchema = z.object({
  websiteId: z.string().uuid("Invalid website id."),
  scanId: z.string().uuid().optional(),
  force: z.boolean().optional().default(false)
});

export const linkScanSchema = websiteSignalScanSchema;
export const seoScanSchema = websiteSignalScanSchema;

export const reportGenerationSchema = z.object({
  websiteId: z.string().uuid(),
  scanId: z.string().uuid()
});

export const reportSendSchema = z.object({
  reportId: z.string().uuid(),
  email: z.string().email().optional()
});

export const paddleCheckoutSchema = z.object({
  plan: z.enum(["starter", "agency"]),
  billingCycle: z.enum(["monthly", "yearly"])
});

export const paddleConfirmSchema = z.object({
  transactionId: z.string().trim().min(3, "Transaction id is required.")
});

export const adminUpdateUserPlanSchema = z
  .object({
    userId: z.string().uuid("Invalid user id."),
    plan: z.enum(["trial", "pro_monthly", "pro_yearly", "growth_monthly", "growth_yearly"]),
    countAsRevenue: z.boolean().default(false),
    note: z.string().trim().max(500, "Keep the note under 500 characters.").optional()
  })
  .superRefine((value, context) => {
    if (value.plan === "trial" && value.countAsRevenue) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Trial resets cannot count as revenue.",
        path: ["countAsRevenue"]
      });
    }
  });

export const settingsSchema = z.object({
  full_name: z.string().trim().min(2, "Full name is required."),
  email: z.string().email(),
  password: z.string().min(8).optional().or(z.literal("")),
  profile_photo_url: z.string().url().optional().or(z.literal("")),
  uptimerobot_api_key: z.string().trim().optional().or(z.literal(""))
});

export const teamMemberSchema = z.object({
  member_email: z.string().email(),
  role: z.enum(["admin", "viewer"]).default("viewer")
});

export const teamInviteSchema = z.object({
  email: z.string().trim().email("Enter a valid teammate email."),
  role: z.enum(["admin", "viewer"]).default("viewer")
});

export const workspaceSwitchSchema = z.object({
  ownerUserId: z.string().uuid("Invalid workspace id.")
});

export const brandingSchema = z.object({
  agency_name: z.string().trim().min(2, "Agency name is required."),
  brand_color: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Use a valid hex color."),
  email_from_name: z.string().trim().min(2, "Email from name is required."),
  logo_url: z.string().url().optional().or(z.literal("")).nullable(),
  client_dashboard_use_branding_logo: z.boolean().optional(),
  reply_to_email: z.string().trim().email("Enter a valid reply-to email.").optional().or(z.literal("")).nullable(),
  agency_website_url: z
    .string()
    .trim()
    .transform((value) => {
      if (!value) {
        return value;
      }

      return urlRegex.test(value) ? value : `https://${value}`;
    })
    .refine((value) => {
      if (!value) {
        return true;
      }

      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    }, "Enter a valid agency website URL.")
    .optional()
    .or(z.literal(""))
    .nullable(),
  report_footer_text: z.string().trim().max(200, "Keep the footer text under 200 characters.").optional().or(z.literal("")).nullable()
});

export const contactMessageSchema = z.object({
  name: z.string().trim().min(2, "Name is required."),
  email: z.string().trim().email("Enter a valid email address."),
  subject: contactSubjectSchema,
  message: z.string().trim().min(20, "Message must be at least 20 characters.")
});

export const adminContactReplySchema = z.object({
  messageId: z.string().uuid("Invalid message id."),
  reply: z.string().trim().min(10, "Reply must be at least 10 characters.")
});
