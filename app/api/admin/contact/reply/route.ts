import { apiError, apiSuccess } from "@/lib/api";
import { requireAdminApiAuthorization } from "@/lib/admin/auth";
import { sendContactReplyEmail } from "@/lib/resend";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { adminContactReplySchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const authError = requireAdminApiAuthorization(request);
  if (authError) {
    return authError;
  }

  const body = await request.json().catch(() => null);
  const parsed = adminContactReplySchema.safeParse(body);

  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid reply payload.", 422);
  }

  const admin = createSupabaseAdminClient();
  const { data: message, error: messageError } = await admin
    .from("contact_messages")
    .select("*")
    .eq("id", parsed.data.messageId)
    .single();

  if (messageError || !message) {
    return apiError(messageError?.message ?? "Message not found.", 404);
  }

  await sendContactReplyEmail({
    messageId: message.id,
    to: message.email,
    name: message.name,
    subject: message.subject,
    reply: parsed.data.reply,
    originalMessage: message.message,
    createdAt: message.created_at
  });

  const { data, error } = await admin
    .from("contact_messages")
    .update({
      admin_reply: parsed.data.reply,
      replied_at: new Date().toISOString(),
      status: "replied"
    })
    .eq("id", parsed.data.messageId)
    .select("*")
    .single();

  if (error || !data) {
    return apiError(error?.message ?? "Unable to save the reply.", 500);
  }

  return apiSuccess(data);
}
