import { processScans } from "./process-scans/route";
import { processUptime } from "./process-uptime/route";
import { syncUptimeRobot } from "./sync-uptimerobot/route";
import { processCompetitors } from "./process-competitors/route";
import { processReports } from "./process-reports/route";
import { expireTrials } from "./expire-trials/route";
import { processLifecycleEmails } from "./process-lifecycle-emails/route";
import { processPaddleWebhooks } from "./process-paddle-webhooks/route";

export async function GET() {

  console.log("=== CRON STARTED ===");

  const results = [];

  async function runJob(name: string, job: () => Promise<void>) {
    try {
      console.log(`Starting: ${name}`);

      await job();

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

  console.log("=== CRON COMPLETED ===");

  return Response.json({
    success: true,
    results
  });
}
