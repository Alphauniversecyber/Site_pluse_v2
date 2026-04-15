import { apiSuccess } from "@/lib/api";
import { requireAdminApiAuthorization } from "@/lib/admin/auth";
import { getAdminBillingMonitoringData } from "@/lib/admin/billing-monitoring";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authError = requireAdminApiAuthorization(request);
  if (authError) {
    return authError;
  }

  const url = new URL(request.url);
  const data = await getAdminBillingMonitoringData(url.searchParams.get("search") ?? "");
  return apiSuccess(data);
}
