export const FRIENDLY_SCAN_FAILURE_MESSAGE =
  "This site couldn't be scanned. This usually happens with sites on free hosting or sites that block automated scanning. Try scanning a different URL.";
export const PAGE_SPEED_RATE_LIMIT_MESSAGE =
  "Google PageSpeed temporarily rate-limited this scan. Try again in a few minutes.";
export const ACCESSIBILITY_SCANNER_UNAVAILABLE_MESSAGE =
  "Accessibility checks are temporarily unavailable on this deployment.";

const FRIENDLY_SCAN_ERROR_PATTERNS = [
  /NO_FCP/i,
  /did not paint any content/i,
  /navigation timeout/i,
  /lighthouse returned error/i,
  /timed out/i
];

const PAGE_SPEED_RATE_LIMIT_PATTERNS = [
  /PageSpeed .*request failed \(429\)/i,
  /\b429\b/i,
  /automated queries/i,
  /protect our users/i,
  /google help/i,
  /we'?re sorry/i
];

const ACCESSIBILITY_SCANNER_UNAVAILABLE_PATTERNS = [
  /could not find chrome/i,
  /puppeteer browsers install chrome/i,
  /cannot find module ['"]puppeteer['"]/i,
  /cannot find module ['"]puppeteer-core['"]/i,
  /cannot find module ['"]@sparticuz\/chromium['"]/i,
  /accessibility scanner could not initialize axe/i,
  /cannot read properties of undefined \(reading ['"]run['"]\)/i,
  /cache path is incorrectly configured/i,
  /ENOENT: no such file or directory.*vendor-chunks[\\/]+runner\.js/i,
  /vendor-chunks[\\/]+runner\.js/i
];

export function isPageSpeedRateLimitError(message?: string | null) {
  if (!message) {
    return false;
  }

  return PAGE_SPEED_RATE_LIMIT_PATTERNS.some((pattern) => pattern.test(message));
}

export function isAccessibilityScannerUnavailableError(message?: string | null) {
  if (!message) {
    return false;
  }

  return ACCESSIBILITY_SCANNER_UNAVAILABLE_PATTERNS.some((pattern) => pattern.test(message));
}

export function shouldUseFriendlyScanFailureMessage(message?: string | null) {
  if (!message) {
    return false;
  }

  return FRIENDLY_SCAN_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

export function getFriendlyScanFailureMessage(message?: string | null) {
  if (isPageSpeedRateLimitError(message)) {
    return PAGE_SPEED_RATE_LIMIT_MESSAGE;
  }

  if (shouldUseFriendlyScanFailureMessage(message)) {
    return FRIENDLY_SCAN_FAILURE_MESSAGE;
  }

  if (isAccessibilityScannerUnavailableError(message)) {
    return ACCESSIBILITY_SCANNER_UNAVAILABLE_MESSAGE;
  }

  return message?.trim() || "The latest scan failed.";
}
