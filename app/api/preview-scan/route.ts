import { apiError, apiSuccess } from "@/lib/api";
import { createPreviewScanSession } from "@/lib/preview-scan";
import { getFriendlyPreviewScanErrorMessage } from "@/lib/scan-errors";
import { previewScanSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = previewScanSchema.safeParse(body);

  if (!parsed.success) {
    return apiError("Please enter a valid website URL.", 422);
  }

  try {
    const preview = await createPreviewScanSession(parsed.data.url);
    return apiSuccess(preview, 201);
  } catch (error) {
    return apiError(
      getFriendlyPreviewScanErrorMessage(
        error instanceof Error ? error.message : "Unable to generate preview."
      ),
      500
    );
  }
}
