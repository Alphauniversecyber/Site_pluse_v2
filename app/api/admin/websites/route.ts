import { apiSuccess } from "@/lib/api";
import { requireAdminApiAuthorization } from "@/lib/admin/auth";
import { getAdminWebsitesData } from "@/lib/admin/data";
import { parsePageParam, parseTextParam } from "@/lib/admin/format";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authError = requireAdminApiAuthorization(request);
  if (authError) {
    return authError;
  }

  const url = new URL(request.url);
  const data = await getAdminWebsitesData({
    search: parseTextParam(url.searchParams.get("search")),
    filter: parseTextParam(url.searchParams.get("filter")) || "all",
    page: parsePageParam(url.searchParams.get("page"), 1),
    pageSize: parsePageParam(url.searchParams.get("pageSize"), 20)
  });

  return apiSuccess(data);
}
