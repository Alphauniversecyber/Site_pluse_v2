import { apiError, apiSuccess } from "@/lib/api";
import { sendContactNotificationEmail } from "@/lib/resend";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { contactMessageSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = contactMessageSchema.safeParse(body);

  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid contact message.", 422);
  }

  const admin = createSupabaseAdminClient();
  const supabase = createSupabaseServerClient();
  const normalizedEmail = parsed.data.email.trim().toLowerCase();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const {
    count,
    error: rateLimitError
  } = await admin
    .from("contact_messages")
    .select("id", { count: "exact", head: true })
    .eq("email", normalizedEmail)
    .gte("created_at", since);

  if (rateLimitError) {
    return apiError(rateLimitError.message, 500);
  }

  if ((count ?? 0) >= 3) {
    return apiError("You've reached the daily message limit for this email. Please try again tomorrow.", 429);
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  const { data: message, error } = await admin
    .from("contact_messages")
    .insert({
      name: parsed.data.name.trim(),
      email: normalizedEmail,
      subject: parsed.data.subject,
      message: parsed.data.message.trim(),
      status: "unread",
      user_id: user?.id ?? null
    })
    .select("*")
    .single();

  if (error || !message) {
    return apiError(error?.message ?? "Unable to send your message.", 500);
  }

  try {
    await sendContactNotificationEmail({
      messageId: message.id,
      name: message.name,
      email: message.email,
      subject: message.subject,
      message: message.message,
      createdAt: message.created_at
    });
  } catch (emailError) {
    console.error("[contact] Notification email failed", {
      messageId: message.id,
      error: emailError instanceof Error ? emailError.message : "Unknown email error"
    });
  }

  return apiSuccess({ success: true });
}
