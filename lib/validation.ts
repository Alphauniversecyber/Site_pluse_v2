import { z } from "zod";

const urlRegex = /^https?:\/\/.+/i;
const reportFrequencySchema = z.enum(["daily", "weekly", "monthly", "never"]);

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
  competitor_urls: z.array(z.string().url()).max(3).optional()
});

export const scanRunSchema = z.object({
  websiteId: z.string().uuid("Invalid website id.")
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
    plan: z.enum(["free", "pro_monthly", "pro_yearly"]),
    countAsRevenue: z.boolean().default(false),
    note: z.string().trim().max(500, "Keep the note under 500 characters.").optional()
  })
  .superRefine((value, context) => {
    if (value.plan === "free" && value.countAsRevenue) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Free plan overrides cannot count as revenue.",
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

export const brandingSchema = z.object({
  agency_name: z.string().trim().min(2, "Agency name is required."),
  brand_color: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Use a valid hex color."),
  email_from_name: z.string().trim().min(2, "Email from name is required."),
  logo_url: z.string().url().optional().or(z.literal("")).nullable()
});
