import { apiError, apiSuccess } from "@/lib/api";
import { createPreviewScanSession } from "@/lib/preview-scan";
import { previewScanSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = previewScanSchema.safeParse(body);

  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid preview scan request.", 422);
  }

  try {
    const preview = await createPreviewScanSession(parsed.data.url);
    return apiSuccess(preview, 201);
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Unable to generate preview.", 500);
  }
}
