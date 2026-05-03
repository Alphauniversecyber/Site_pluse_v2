import { apiError, apiSuccess, requireApiUser } from "@/lib/api";
import { confirmPaddleTransaction } from "@/lib/paddle-subscriptions";
import { paddleConfirmSchema } from "@/lib/validation";
import { canAccessWorkspaceBilling, resolveWorkspaceContext } from "@/lib/workspace";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { profile, errorResponse } = await requireApiUser();
  if (errorResponse || !profile) {
    return errorResponse;
  }
  const workspace = await resolveWorkspaceContext(profile);
  if (!canAccessWorkspaceBilling(workspace)) {
    return apiError("Only the workspace owner can manage billing.", 403);
  }

  const body = await request.json().catch(() => null);
  const parsed = paddleConfirmSchema.safeParse(body);

  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid Paddle confirmation request.", 422);
  }

  try {
    const result = await confirmPaddleTransaction(parsed.data.transactionId, profile.id);

    return apiSuccess({
      subscriptionId: result.subscription.id,
      transactionId: result.transaction.id,
      status: result.subscriptionRow.status
    });
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "Unable to confirm the Paddle checkout.",
      500
    );
  }
}
