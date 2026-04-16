import { apiSuccess } from "@/lib/api";
import { requireAdminApiAuthorization } from "@/lib/admin/auth";
import { getAdminEmailMonitoringData } from "@/lib/admin/email-monitoring";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authError = requireAdminApiAuthorization(request);
  if (authError) {
    return authError;
  }

  const url = new URL(request.url);
  const data = await getAdminEmailMonitoringData({
    user: url.searchParams.get("user") ?? "",
    status: url.searchParams.get("status") ?? "all",
    date: url.searchParams.get("date") ?? ""
  });

  return apiSuccess(data);
}
