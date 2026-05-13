import { apiError, apiSuccess, withNoIndex } from "@/lib/api";
import { buildClientDashboardPayload } from "@/lib/client-token";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: { token: string } }
) {
  const payload = await buildClientDashboardPayload(params.token);

  if (!payload) {
    return withNoIndex(apiError("This link is invalid or has expired.", 404));
  }

  return withNoIndex(apiSuccess(payload));
}
