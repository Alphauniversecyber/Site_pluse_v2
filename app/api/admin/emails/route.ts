import { apiSuccess } from "@/lib/api";
import { requireAdminApiAuthorization } from "@/lib/admin/auth";
import { getAdminEmailsData } from "@/lib/admin/data";
import { parsePageParam } from "@/lib/admin/format";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authError = requireAdminApiAuthorization(request);
  if (authError) {
    return authError;
  }

  const url = new URL(request.url);
  const data = await getAdminEmailsData({
    page: parsePageParam(url.searchParams.get("page"), 1),
    pageSize: parsePageParam(url.searchParams.get("pageSize"), 20)
  });

  return apiSuccess(data);
}
