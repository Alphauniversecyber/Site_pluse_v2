import "server-only";

import axeCore from "axe-core";

import type { ScanIssue, ScanRecommendation } from "@/types";
import { ACCESSIBILITY_SCANNER_UNAVAILABLE_MESSAGE, isAccessibilityScannerUnavailableError } from "@/lib/scan-errors";

function parsePositiveInt(raw: string | undefined, fallback: number) {
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const PA11Y_NAVIGATION_TIMEOUT_MS = parsePositiveInt(process.env.PA11Y_NAVIGATION_TIMEOUT_MS, 25_000);
const PA11Y_AUDIT_TIMEOUT_MS = parsePositiveInt(process.env.PA11Y_AUDIT_TIMEOUT_MS, 20_000);

type BrowserPage = {
  addScriptTag: (options: { content: string }) => Promise<unknown>;
  evaluate: <T>(pageFunction: () => T | Promise<T>) => Promise<T>;
  goto: (
    url: string,
    options: {
      waitUntil: "networkidle2";
      timeout: number;
    }
  ) => Promise<unknown>;
  setBypassCSP: (enabled: boolean) => Promise<void>;
};

type BrowserInstance = {
  close: () => Promise<void>;
  newPage: () => Promise<BrowserPage>;
};

type AxeNode = {
  failureSummary?: string;
  target?: string[];
};

type AxeViolation = {
  description?: string;
  help?: string;
  helpUrl?: string;
  id?: string;
  impact?: string | null;
  nodes?: AxeNode[];
};

type AxeRunResult = {
  violations?: AxeViolation[];
};

async function getBrowser(): Promise<BrowserInstance> {
  const launchArgs = ["--no-sandbox", "--disable-setuid-sandbox"];
  const useServerlessChromium =
    process.env.VERCEL === "1" ||
    process.env.VERCEL === "true" ||
    Boolean(process.env.AWS_REGION) ||
    process.platform === "linux";

  if (useServerlessChromium) {
    const [{ default: chromium }, { default: puppeteerCore }] = await Promise.all([
      import("@sparticuz/chromium"),
      import("puppeteer-core")
    ]);
    const headlessMode = "shell" as const;

    return puppeteerCore.launch({
      headless: headlessMode,
      args: puppeteerCore.defaultArgs({
        args: [...chromium.args, ...launchArgs],
        headless: headlessMode
      }),
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || (await chromium.executablePath()),
      defaultViewport: {
        width: 1280,
        height: 800
      }
    });
  }

  const { default: puppeteer } = await import("puppeteer");

  return puppeteer.launch({
    headless: true,
    args: launchArgs,
    defaultViewport: {
      width: 1280,
      height: 800
    }
  });
}

function mapImpactToSeverity(impact?: string | null): "low" | "medium" | "high" {
  if (impact === "critical" || impact === "serious") {
    return "high";
  }

  if (impact === "moderate" || impact === "warning") {
    return "medium";
  }

  return "low";
}

function getViolationMetric(violation: AxeViolation) {
  const firstTarget = violation.nodes?.[0]?.target?.[0];

  if (firstTarget) {
    return firstTarget;
  }

  return `${violation.nodes?.length ?? 0} affected node(s)`;
}

async function runAxeAudit(page: BrowserPage) {
  const auditResult = page.evaluate(async (): Promise<AxeRunResult> => {
    const axe = (window as typeof window & {
      axe: {
        run: (node?: Element | Document, options?: Record<string, unknown>) => Promise<AxeRunResult>;
      };
    }).axe;

    return axe.run(document, {
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa", "best-practice"]
      }
    });
  });

  return Promise.race([
    auditResult,
    new Promise<AxeRunResult>((_, reject) => {
      setTimeout(() => reject(new Error("Accessibility audit timed out.")), PA11Y_AUDIT_TIMEOUT_MS);
    })
  ]);
}

async function ensureAxeLoaded(page: BrowserPage) {
  const hasAxeRunner = await page.evaluate(() => {
    const axe = (window as typeof window & {
      axe?: {
        run?: unknown;
      };
    }).axe;

    return typeof axe?.run === "function";
  });

  if (!hasAxeRunner) {
    throw new Error("Accessibility scanner could not initialize axe.");
  }
}

export async function runAccessibilityScan(url: string) {
  let browser: BrowserInstance | null = null;

  try {
    browser = await getBrowser();

    const page = await browser.newPage();
    await page.setBypassCSP(true);
    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: PA11Y_NAVIGATION_TIMEOUT_MS
    });

    await page.addScriptTag({
      content: axeCore.source
    });
    await ensureAxeLoaded(page);

    const axeResults = await runAxeAudit(page);
    const axeViolations = (axeResults.violations ?? []).map((violation) => ({
      source: "axe",
      id: violation.id ?? "accessibility-violation",
      impact: violation.impact ?? null,
      description: violation.description ?? "A WCAG accessibility issue was detected.",
      help: violation.help ?? "Fix accessibility issue",
      helpUrl: violation.helpUrl ?? null,
      nodes: violation.nodes?.length ?? 0,
      selectors: violation.nodes?.flatMap((node) => node.target ?? []).slice(0, 5) ?? [],
      failureSummaries:
        violation.nodes
          ?.map((node) => node.failureSummary?.trim())
          .filter((value): value is string => Boolean(value))
          .slice(0, 3) ?? [],
      severity: mapImpactToSeverity(violation.impact ?? null)
    }));

    const issues: ScanIssue[] = axeViolations.slice(0, 10).map((violation, index) => {
      const sourceViolation = axeResults.violations?.[index] ?? {};

      return {
        id: `axe-${index}`,
        title: String(violation.help ?? violation.id ?? "Accessibility violation"),
        description: String(
          violation.failureSummaries[0] ??
            violation.description ??
            "A WCAG accessibility issue was detected."
        ),
        severity: violation.severity,
        metric: getViolationMetric(sourceViolation)
      };
    });

    const recommendations: ScanRecommendation[] = axeViolations.slice(0, 10).map((violation, index) => ({
      id: `accessibility-rec-${index}`,
      title: String(violation.help ?? "Fix accessibility issue"),
      description: String(violation.description ?? "Review and resolve this accessibility issue."),
      priority: violation.severity,
      link: typeof violation.helpUrl === "string" ? violation.helpUrl : null
    }));

    return {
      accessibilityViolations: axeViolations,
      issues,
      recommendations,
      raw: {
        axe: axeResults
      },
      error: null as string | null
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Accessibility scan failed.";
    const browserUnavailable = isAccessibilityScannerUnavailableError(message);

    return {
      accessibilityViolations: [] as Array<Record<string, unknown>>,
      issues: [] as ScanIssue[],
      recommendations: [] as ScanRecommendation[],
      raw: {
        error: message,
        warning: browserUnavailable ? ACCESSIBILITY_SCANNER_UNAVAILABLE_MESSAGE : null
      },
      error: browserUnavailable ? null : message
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
