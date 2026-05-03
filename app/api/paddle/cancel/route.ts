import { apiError, apiSuccess, requireApiUser } from "@/lib/api";
import { cancelUserPaddleSubscription } from "@/lib/paddle-subscriptions";
import { canAccessWorkspaceBilling, resolveWorkspaceContext } from "@/lib/workspace";

export const runtime = "nodejs";

export async function POST() {
  const { profile, errorResponse } = await requireApiUser();
  if (errorResponse || !profile) {
    return errorResponse;
  }
  const workspace = await resolveWorkspaceContext(profile);
  if (!canAccessWorkspaceBilling(workspace)) {
    return apiError("Only the workspace owner can manage billing.", 403);
  }

  try {
    const result = await cancelUserPaddleSubscription(profile);

    return apiSuccess({
      subscriptionId: result.subscription.id,
      status: result.subscription.status,
      nextBillingDate: result.subscription.next_billed_at,
      scheduledCancellationAt: result.scheduledCancellationAt,
      planName: result.selection.planName
    });
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "Unable to cancel the Paddle subscription.",
      500
    );
  }
}
