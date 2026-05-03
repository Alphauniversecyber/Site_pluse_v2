import { apiError, apiSuccess } from "@/lib/api";
import { requireAdminApiAuthorization } from "@/lib/admin/auth";
import { getFailedTaskById, markFailedTaskResolved } from "@/lib/failed-tasks";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const authError = requireAdminApiAuthorization(request);
  if (authError) {
    return authError;
  }

  const body = (await request.json().catch(() => null)) as { taskId?: string } | null;
  const taskId = body?.taskId?.trim();

  if (!taskId) {
    return apiError("taskId is required.", 422);
  }

  const task = await getFailedTaskById(taskId);

  if (!task) {
    return apiError("Failed task not found.", 404);
  }

  const updatedTask = await markFailedTaskResolved(task.id);
  return apiSuccess({
    task: updatedTask
  });
}
