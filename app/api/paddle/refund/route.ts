import { apiError, apiSuccess, requireApiUser } from "@/lib/api";
import {
  getPaddleRefundEligibility,
  refundUserPaddlePayment
} from "@/lib/paddle-subscriptions";
import { canAccessWorkspaceBilling, resolveWorkspaceContext } from "@/lib/workspace";

export const runtime = "nodejs";

export async function GET() {
  const { profile, errorResponse } = await requireApiUser();
  if (errorResponse || !profile) {
    return errorResponse;
  }
  const workspace = await resolveWorkspaceContext(profile);
  if (!canAccessWorkspaceBilling(workspace)) {
    return apiError("Only the workspace owner can manage billing.", 403);
  }

  try {
    const eligibility = await getPaddleRefundEligibility(profile);
    return apiSuccess(eligibility);
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "Unable to load Paddle refund eligibility.",
      500
    );
  }
}

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
    const result = await refundUserPaddlePayment(profile);

    return apiSuccess({
      adjustmentId: result.adjustment.id,
      refundStatus: result.adjustment.status,
      refundableUntil: result.eligibility.refundableUntil,
      transactionId: result.eligibility.transactionId,
      cancellationWarning: result.cancellationWarning,
      canceledSubscriptionStatus: result.cancelledSubscription?.status ?? null
    });
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "Unable to request a Paddle refund.",
      500
    );
  }
}
