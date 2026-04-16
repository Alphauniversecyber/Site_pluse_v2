import "server-only";

function parsePositiveInt(raw: string | undefined, fallback: number) {
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getCronBatchLimit(envName: string, fallback: number) {
  return parsePositiveInt(process.env[envName], fallback);
}

export function getCronSoftTimeoutMs(fallback: number) {
  return parsePositiveInt(process.env.CRON_SOFT_TIMEOUT_MS, fallback);
}

export type CronExecutionGuard = {
  shouldStop(context?: Record<string, unknown>): boolean;
};

export function createCronExecutionGuard(label: string, fallbackSoftTimeoutMs: number): CronExecutionGuard {
  const startedAt = Date.now();
  const softTimeoutMs = Math.max(getCronSoftTimeoutMs(fallbackSoftTimeoutMs), fallbackSoftTimeoutMs);
  let logged = false;

  return {
    shouldStop(context: Record<string, unknown> = {}) {
      const elapsedMs = Date.now() - startedAt;
      if (elapsedMs < softTimeoutMs) {
        return false;
      }

      if (!logged) {
        logged = true;
        console.warn(`[cron:${label}] Soft timeout reached. Stopping early to avoid a hard function timeout.`, {
          elapsedMs,
          softTimeoutMs,
          ...context
        });
      }

      return true;
    }
  };
}
