import "server-only";

import type { FailedTaskRecord } from "@/lib/failed-tasks";
import { retryActivationEmailTask, type ActivationEmailType } from "@/lib/lifecycle-email-service";
import { retryQueuedPaddleWebhookTask } from "@/lib/paddle-subscriptions";
import { retryReportEmailQueueTask } from "@/lib/report-email-queue";
import { retryReportPdfQueueTask } from "@/lib/report-pdf-queue";
import { retryWebsiteScanTask } from "@/lib/scan-job-queue";
import { retryCompetitorScanTask } from "@/lib/competitor-monitoring";
import {
  retryDailyUptimeCheckTask,
  retryUptimeRobotSyncUserTask
} from "@/lib/uptime-monitoring";

function getString(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Failed task payload is missing ${label}.`);
  }

  return value;
}

function getActivationEmailType(taskType: FailedTaskRecord["task_type"]): ActivationEmailType {
  if (taskType === "send-activation-day1") {
    return "activation_day1";
  }

  if (taskType === "send-activation-day3") {
    return "activation_day3";
  }

  return "activation_day7";
}

export async function retryFailedTask(task: FailedTaskRecord) {
  switch (task.task_type) {
    case "generate-report": {
      const result = await retryReportPdfQueueTask({
        queueId: getString(task.payload.queueId, "queueId")
      });

      if (result.status !== "completed") {
        throw new Error(result.message ?? "Report generation could not be retried.");
      }

      return result;
    }
    case "send-report-email": {
      const result = await retryReportEmailQueueTask({
        queueId: getString(task.payload.queueId, "queueId")
      });

      if (result.status !== "sent") {
        throw new Error(result.message ?? "Report email could not be retried.");
      }

      return result;
    }
    case "execute-scan": {
      return retryWebsiteScanTask({
        websiteId: getString(task.payload.websiteId, "websiteId")
      });
    }
    case "send-activation-day1":
    case "send-activation-day3":
    case "send-activation-day7": {
      return retryActivationEmailTask({
        userId: getString(task.payload.userId, "userId"),
        emailType: getActivationEmailType(task.task_type)
      });
    }
    case "run-uptime-check": {
      return retryDailyUptimeCheckTask({
        websiteId: getString(task.payload.websiteId, "websiteId")
      });
    }
    case "sync-uptimerobot-user": {
      return retryUptimeRobotSyncUserTask({
        userId: getString(task.payload.userId, "userId")
      });
    }
    case "scan-competitor": {
      return retryCompetitorScanTask({
        websiteId: getString(task.payload.websiteId, "websiteId"),
        competitorUrl: getString(task.payload.competitorUrl, "competitorUrl")
      });
    }
    case "process-paddle-webhook": {
      return retryQueuedPaddleWebhookTask({
        webhookEventId: getString(task.payload.webhookEventId, "webhookEventId")
      });
    }
    default: {
      throw new Error(`Unsupported task type: ${task.task_type}`);
    }
  }
}
