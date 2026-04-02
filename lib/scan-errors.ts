export const FRIENDLY_SCAN_FAILURE_MESSAGE =
  "This site couldn't be scanned. This usually happens with sites on free hosting or sites that block automated scanning. Try scanning a different URL.";

const FRIENDLY_SCAN_ERROR_PATTERNS = [
  /NO_FCP/i,
  /did not paint any content/i,
  /navigation timeout/i,
  /lighthouse returned error/i,
  /timed out/i
];

export function shouldUseFriendlyScanFailureMessage(message?: string | null) {
  if (!message) {
    return false;
  }

  return FRIENDLY_SCAN_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

export function getFriendlyScanFailureMessage(message?: string | null) {
  if (shouldUseFriendlyScanFailureMessage(message)) {
    return FRIENDLY_SCAN_FAILURE_MESSAGE;
  }

  return message?.trim() || "The latest scan failed.";
}
