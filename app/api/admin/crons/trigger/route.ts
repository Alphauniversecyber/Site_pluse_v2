import { apiError, apiSuccess } from "@/lib/api";
import { requireAdminApiAuthorization } from "@/lib/admin/auth";
import { ADMIN_CRON_NAMES, type AdminCronName } from "@/lib/admin/constants";
import { triggerAdminCron } from "@/lib/admin/data";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const authError = requireAdminApiAuthorization(request);
  if (authError) {
    return authError;
  }

  const body = (await request.json().catch(() => null)) as { cronName?: string } | null;
  const cronName = body?.cronName;

  if (!cronName || !ADMIN_CRON_NAMES.includes(cronName as AdminCronName)) {
    return apiError("Invalid cron name.", 422);
  }

  const result = await triggerAdminCron(cronName as AdminCronName);
  return apiSuccess(result, result.ok ? 200 : 500);
}
