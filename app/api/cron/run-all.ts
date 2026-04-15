import { processScans } from "./process-scans";
import { processUptime } from "./process-uptime";
import { syncUptimeRobot } from "./sync-uptimerobot";
import { processCompetitors } from "./process-competitors";
import { processReports } from "./process-reports";
import { expireTrials } from "./expire-trials";
import { processLifecycleEmails } from "./process-lifecycle-emails";
import { processPaddleWebhooks } from "./process-paddle-webhooks";

export default async function handler(req: any, res: any) {

  console.log("=== DAILY CRON STARTED ===");

  const results = [];

  async function runJob(name: string, job: () => Promise<void>) {
    try {
      console.log(`Starting: ${name}`);

      await job();

      console.log(`Finished: ${name}`);

      results.push({
        job: name,
        status: "success"
      });

    } catch (error) {

      console.error(`${name} failed`, error);

      results.push({
        job: name,
        status: "failed"
      });

    }
  }

  await runJob("processScans", processScans);
  await runJob("processUptime", processUptime);
  await runJob("syncUptimeRobot", syncUptimeRobot);
  await runJob("processCompetitors", processCompetitors);
  await runJob("processReports", processReports);
  await runJob("expireTrials", expireTrials);
  await runJob("processLifecycleEmails", processLifecycleEmails);
  await runJob("processPaddleWebhooks", processPaddleWebhooks);

  console.log("=== DAILY CRON COMPLETED ===");

  res.status(200).json({
    success: true,
    results
  });
}
