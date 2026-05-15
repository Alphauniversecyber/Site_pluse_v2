const CHROME_USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36"
] as const;

let userAgentCursor = 0;

export function pickBrowserUserAgent() {
  const userAgent = CHROME_USER_AGENTS[userAgentCursor % CHROME_USER_AGENTS.length] ?? CHROME_USER_AGENTS[0];
  userAgentCursor += 1;
  return userAgent;
}

export function buildBrowserLikeHeaders(overrides?: Record<string, string>) {
  return {
    "user-agent": pickBrowserUserAgent(),
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "accept-language": "en-US,en;q=0.9",
    "accept-encoding": "gzip, deflate, br",
    connection: "keep-alive",
    "cache-control": "no-cache",
    pragma: "no-cache",
    ...overrides
  };
}

export async function addBrowserRequestDelay(minMs = 300, maxMs = 500) {
  const jitter = Math.floor(Math.random() * Math.max(maxMs - minMs + 1, 1));
  const delayMs = minMs + jitter;

  await new Promise((resolve) => setTimeout(resolve, delayMs));
}
