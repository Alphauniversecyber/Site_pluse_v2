import { apiError, apiSuccess } from "@/lib/api";
import { requireAdminApiAuthorization } from "@/lib/admin/auth";
import { retryFailedTask } from "@/lib/failed-task-retry";
import {
  getFailedTaskById,
  markFailedTaskResolved,
  markFailedTaskRetryFailed
} from "@/lib/failed-tasks";

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

  if (task.status === "resolved") {
    return apiError("Resolved tasks do not need to be retried.", 409);
  }

  try {
    const result = await retryFailedTask(task);
    const updatedTask = await markFailedTaskResolved(task.id);

    return apiSuccess({
      task: updatedTask,
      result
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to retry the failed task.";
    await markFailedTaskRetryFailed(task.id, message, "failed");
    return apiError(message, 500);
  }
}
