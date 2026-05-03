import { apiError, apiSuccess } from "@/lib/api";
import { requireAdminApiAuthorization } from "@/lib/admin/auth";
import { getAdminContactMessagesData } from "@/lib/admin/contact-messages";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authError = requireAdminApiAuthorization(request);
  if (authError) {
    return authError;
  }

  const data = await getAdminContactMessagesData();
  if (data.error) {
    return apiError(data.error, 500);
  }

  return apiSuccess(data);
}
