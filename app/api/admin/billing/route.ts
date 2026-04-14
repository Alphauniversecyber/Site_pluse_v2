import { apiSuccess } from "@/lib/api";
import { requireAdminApiAuthorization } from "@/lib/admin/auth";
import { getAdminBillingData } from "@/lib/admin/data";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authError = requireAdminApiAuthorization(request);
  if (authError) {
    return authError;
  }

  const data = await getAdminBillingData();
  return apiSuccess(data);
}
