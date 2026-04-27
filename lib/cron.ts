import "server-only";

function parsePositiveInt(raw: string | undefined, fallback: number) {
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseNonNegativeInt(raw: string | undefined | null, fallback: number) {
  if (raw === undefined || raw === null || raw === "") {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function getCronBatchLimit(envName: string, fallback: number) {
  return parsePositiveInt(process.env[envName], fallback);
}

export function getCronSoftTimeoutMs(fallback: number) {
  return parsePositiveInt(process.env.CRON_SOFT_TIMEOUT_MS, fallback);
}

export function getCronChainLimit(fallback: number) {
  return parsePositiveInt(process.env.CRON_CHAIN_LIMIT, fallback);
}

export function getCronContinuationTimeoutMs(fallback: number) {
  return parsePositiveInt(process.env.CRON_CONTINUATION_TIMEOUT_MS, fallback);
}

export type CronExecutionGuard = {
  shouldStop(context?: Record<string, unknown>): boolean;
};

export type CronContinuationDispatch = {
  queued: boolean;
  reason:
    | "queued"
    | "no_more_work"
    | "deferred_to_scheduler"
    | "chain_limit_reached"
    | "missing_secret"
    | "dispatch_failed";
  nextCursor: number | null;
  nextChainDepth: number;
  maxChainDepth: number;
  errorMessage?: string | null;
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

export function getCronCursorOffset(request: Request) {
  return parseNonNegativeInt(new URL(request.url).searchParams.get("cursor"), 0);
}

export function getCronChainDepth(request: Request) {
  return parseNonNegativeInt(new URL(request.url).searchParams.get("chain"), 0);
}

function getCronBaseUrl() {
  const configuredBaseUrl =
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    null;

  return configuredBaseUrl || null;
}

function resolveCronContinuationUrl(request: Request) {
  const requestUrl = new URL(request.url);
  const configuredBaseUrl = getCronBaseUrl();

  if (configuredBaseUrl) {
    const url = new URL(requestUrl.pathname, configuredBaseUrl);
    url.search = requestUrl.search;
    return url;
  }

  const forwardedHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (forwardedHost) {
    const forwardedProto = request.headers.get("x-forwarded-proto") ?? requestUrl.protocol.replace(/:$/, "");
    const url = new URL(`${forwardedProto}://${forwardedHost}${requestUrl.pathname}`);
    url.search = requestUrl.search;
    return url;
  }

  return requestUrl;
}

export async function dispatchCronContinuation(input: {
  request: Request;
  label: string;
  hasMore: boolean;
  nextCursor?: number | null;
  defaultChainLimit?: number;
  defaultDispatchTimeoutMs?: number;
}): Promise<CronContinuationDispatch> {
  const nextCursor = input.nextCursor ?? null;
  const chainDepth = getCronChainDepth(input.request);
  const maxChainDepth = getCronChainLimit(input.defaultChainLimit ?? 24);
  const nextChainDepth = chainDepth + 1;

  if (!input.hasMore) {
    return {
      queued: false,
      reason: "no_more_work",
      nextCursor,
      nextChainDepth,
      maxChainDepth
    };
  }

  if (nextChainDepth > maxChainDepth) {
    console.warn(`[cron:${input.label}] Chain limit reached while work is still pending.`, {
      chainDepth,
      maxChainDepth,
      nextCursor
    });

    return {
      queued: false,
      reason: "chain_limit_reached",
      nextCursor,
      nextChainDepth,
      maxChainDepth
    };
  }

  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) {
    console.warn(`[cron:${input.label}] Missing CRON_SECRET, so the next batch could not be queued.`, {
      nextCursor
    });

    return {
      queued: false,
      reason: "missing_secret",
      nextCursor,
      nextChainDepth,
      maxChainDepth
    };
  }

  const url = resolveCronContinuationUrl(input.request);
  url.searchParams.set("chain", String(nextChainDepth));
  if (nextCursor === null) {
    url.searchParams.delete("cursor");
  } else {
    url.searchParams.set("cursor", String(nextCursor));
  }

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      cache: "no-store",
      headers: {
        authorization: `Bearer ${cronSecret}`,
        "x-sitepulse-cron-secret": cronSecret,
        "x-sitepulse-cron-chain": String(nextChainDepth)
      },
      signal: AbortSignal.timeout(getCronContinuationTimeoutMs(input.defaultDispatchTimeoutMs ?? 8_000))
    });

    if (!response.ok) {
      throw new Error(`Continuation request failed with status ${response.status}.`);
    }

    return {
      queued: true,
      reason: "queued",
      nextCursor,
      nextChainDepth,
      maxChainDepth
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown continuation dispatch error.";
    console.warn(`[cron:${input.label}] Unable to queue the next batch.`, {
      nextCursor,
      chainDepth,
      maxChainDepth,
      error: message
    });

    return {
      queued: false,
      reason: "dispatch_failed",
      nextCursor,
      nextChainDepth,
      maxChainDepth,
      errorMessage: message
    };
  }
}
