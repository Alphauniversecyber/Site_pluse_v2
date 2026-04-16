import { apiSuccess } from "@/lib/api";
import { requireAdminApiAuthorization } from "@/lib/admin/auth";
import { getAdminScanMonitoringData } from "@/lib/admin/scan-monitoring";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authError = requireAdminApiAuthorization(request);
  if (authError) {
    return authError;
  }

  const url = new URL(request.url);
  const data = await getAdminScanMonitoringData({
    user: url.searchParams.get("user") ?? "",
    status: url.searchParams.get("status") ?? "all",
    date: url.searchParams.get("date") ?? ""
  });

  return apiSuccess(data);
}
