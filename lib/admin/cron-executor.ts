import "server-only";

import type { AdminCronName } from "@/lib/admin/constants";
import { runLoggedCron } from "@/lib/admin/logging";
import { processCompetitorScans } from "@/lib/competitor-monitoring";
import { processLifecycleEmails } from "@/lib/lifecycle-email-service";
import { processQueuedPaddleWebhooks } from "@/lib/paddle-subscriptions";
import { processDueEmailReports } from "@/lib/report-service";
import { processDueScans } from "@/lib/scan-service";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { processDailyUptimeChecks, processUptimeRobotSync } from "@/lib/uptime-monitoring";

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

export async function executeAdminCron(cronName: AdminCronName): Promise<Record<string, unknown>> {
  switch (cronName) {
    case "process-scans": {
      const executed = await runLoggedCron("process-scans", () => processDueScans());
      return { executed };
    }
    case "process-reports": {
      const sent = await runLoggedCron("process-reports", () => processDueEmailReports());
      return { sent };
    }
    case "process-uptime": {
      const processed = await runLoggedCron("process-uptime", () => processDailyUptimeChecks());
      return { processed };
    }
    case "sync-uptimerobot": {
      const synced = await runLoggedCron("sync-uptimerobot", () => processUptimeRobotSync());
      return { synced };
    }
    case "process-competitors": {
      const processed = await runLoggedCron("process-competitors", () => processCompetitorScans());
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
