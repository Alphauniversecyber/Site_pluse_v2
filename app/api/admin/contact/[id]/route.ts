import { z } from "zod";

import { apiError, apiSuccess } from "@/lib/api";
import { requireAdminApiAuthorization } from "@/lib/admin/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const updateSchema = z.object({
  status: z.enum(["read"])
});

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const authError = requireAdminApiAuthorization(request);
  if (authError) {
    return authError;
  }

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid update payload.", 422);
  }

  const admin = createSupabaseAdminClient();
  const { data: existing, error: existingError } = await admin
    .from("contact_messages")
    .select("*")
    .eq("id", params.id)
    .single();

  if (existingError || !existing) {
    return apiError(existingError?.message ?? "Message not found.", 404);
  }

  const nextStatus = existing.status === "unread" ? "read" : existing.status;
  const { data, error } = await admin
    .from("contact_messages")
    .update({ status: nextStatus })
    .eq("id", params.id)
    .select("*")
    .single();

  if (error || !data) {
    return apiError(error?.message ?? "Unable to update message.", 500);
  }

  return apiSuccess(data);
}
