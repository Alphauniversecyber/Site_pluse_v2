import "server-only";

import type { AdminCronName } from "@/lib/admin/constants";
import { runLoggedCron } from "@/lib/admin/logging";
import { enqueueJob } from "@/lib/job-queue";
import { drainQueue } from "@/lib/job-queue-worker";
import { processLifecycleEmails } from "@/lib/lifecycle-email-service";
import { processQueuedPaddleWebhooks } from "@/lib/paddle-subscriptions";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { processUptimeRobotSync } from "@/lib/uptime-monitoring";

async function expireTrials() {
  const admin = createSupabaseAdminClient();

  return runLoggedCron("expire-trials", async () => {
    const { data, error } = await admin
      .from("users")
      .update({
        plan: "free",
        billing_cycle: null,
        subscription_price: null,
        subscription_status: "inactive",
        is_trial: false
      })
      .eq("is_trial", true)
      .lt("trial_ends_at", new Date().toISOString())
      .select("id");

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []).length;
  });
}

async function queueAndDrainCron(input: {
  cronName: Extract<
    AdminCronName,
    "process-scans" | "process-reports" | "process-uptime" | "process-competitors"
  >;
  payload: {
    mode?: "discover" | "process-queue";
    discoveryOffset?: number;
    offset?: number;
    requestedAt: string;
    source: string;
  };
}) {
  return runLoggedCron(input.cronName, async () => {
    const queued = await enqueueJob(input.cronName, input.payload, {
      skipIfOpen: true
    });
    const drained = await drainQueue(20);

    return {
      processedCount: drained.processed,
      queued: queued.queued,
      jobId: queued.job.id,
      remaining: drained.remaining,
      done: drained.done,
      iterations: drained.iterations
    };
  });
}

export async function executeAdminCron(cronName: AdminCronName): Promise<Record<string, unknown>> {
  switch (cronName) {
    case "process-scans": {
      const executed = await queueAndDrainCron({
        cronName: "process-scans",
        payload: {
          mode: "discover",
          discoveryOffset: 0,
          requestedAt: new Date().toISOString(),
          source: "admin"
        }
      });
      return { executed };
    }
    case "process-reports": {
      const sent = await queueAndDrainCron({
        cronName: "process-reports",
        payload: {
          mode: "discover",
          discoveryOffset: 0,
          requestedAt: new Date().toISOString(),
          source: "admin"
        }
      });
      return { sent };
    }
    case "process-uptime": {
      const processed = await queueAndDrainCron({
        cronName: "process-uptime",
        payload: {
          mode: "process-queue",
          offset: 0,
          requestedAt: new Date().toISOString(),
          source: "admin"
        }
      });
      return { processed };
    }
    case "sync-uptimerobot": {
      const synced = await runLoggedCron("sync-uptimerobot", () => processUptimeRobotSync());
      return { synced };
    }
    case "process-competitors": {
      const processed = await queueAndDrainCron({
        cronName: "process-competitors",
        payload: {
          mode: "discover",
          discoveryOffset: 0,
          requestedAt: new Date().toISOString(),
          source: "admin"
        }
      });
      return { processed };
    }
    case "expire-trials": {
      const count = await expireTrials();
      return { count };
    }
    case "process-lifecycle-emails": {
      const sent = await runLoggedCron("process-lifecycle-emails", () => processLifecycleEmails());
      return { sent };
    }
    case "process-paddle-webhooks": {
      const processed = await runLoggedCron("process-paddle-webhooks", () =>
        processQueuedPaddleWebhooks()
      );
      return { processed };
    }
  }
}
