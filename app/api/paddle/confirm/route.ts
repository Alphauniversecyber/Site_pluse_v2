import { apiError, apiSuccess, requireApiUser } from "@/lib/api";
import { confirmPaddleTransaction } from "@/lib/paddle-subscriptions";
import { paddleConfirmSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { profile, errorResponse } = await requireApiUser();
  if (errorResponse || !profile) {
    return errorResponse;
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
