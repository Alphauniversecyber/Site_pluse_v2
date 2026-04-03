import { apiError, apiSuccess, requireApiUser } from "@/lib/api";

export const runtime = "nodejs";

export async function DELETE() {
  const { supabase, user, errorResponse } = await requireApiUser();
  if (errorResponse) {
    return errorResponse;
  }

  try {
    const { data, error } = await supabase
      .from("notifications")
      .delete()
      .eq("user_id", user.id)
      .select("id");

    if (error) {
      console.error("[api:notifications] clear failed", {
        userId: user.id,
        error: error.message
      });

      return apiError(error.message, 500);
    }

    const cleared = data?.length ?? 0;

    console.info("[api:notifications] cleared", {
      userId: user.id,
      cleared
    });

    return apiSuccess({ cleared });
  } catch (error) {
    console.error("[api:notifications] unexpected clear error", {
      userId: user.id,
      error: error instanceof Error ? error.message : "Unable to clear notifications."
    });

    return apiError(error instanceof Error ? error.message : "Unable to clear notifications.", 500);
  }
}
