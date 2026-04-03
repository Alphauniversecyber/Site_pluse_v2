import "server-only";

import { createRequire } from "node:module";

import axeCore from "axe-core";

import type { ScanIssue, ScanRecommendation } from "@/types";
import { ACCESSIBILITY_SCANNER_UNAVAILABLE_MESSAGE, isAccessibilityScannerUnavailableError } from "@/lib/scan-errors";

const nodeRequire = createRequire(import.meta.url);

type Pa11yRunner = (
  url: string,
  options: Record<string, unknown>
) => Promise<{
  issues: any[];
}>;

type PuppeteerModule = {
  launch: (options: Record<string, unknown>) => Promise<any>;
};

let pa11yRunner: Pa11yRunner | null = null;
let puppeteerModule: PuppeteerModule | null = null;

function requireRuntimeDefault<T>(specifier: string): T {
  const loaded = nodeRequire(specifier) as T | { default?: T };

  if (loaded && typeof loaded === "object" && "default" in loaded && loaded.default) {
    return loaded.default;
  }

  return loaded as T;
}

function getPa11yRunner() {
  if (!pa11yRunner) {
    pa11yRunner = requireRuntimeDefault<Pa11yRunner>("pa11y");
  }

  return pa11yRunner;
}

function getPuppeteerModule() {
  if (!puppeteerModule) {
    puppeteerModule = requireRuntimeDefault<PuppeteerModule>("puppeteer");
  }

  return puppeteerModule;
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

export async function runAccessibilityScan(url: string) {
  let browser: Awaited<ReturnType<PuppeteerModule["launch"]>> | null = null;

  try {
    const puppeteer = getPuppeteerModule();
    const pa11y = getPa11yRunner();

    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();
    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 45000
    });

    const pa11yResults = await pa11y(url, {
      browser,
      standard: "WCAG2AA",
      timeout: 30000,
      includeNotices: false,
      includeWarnings: true
    });

    await page.addScriptTag({
      content: axeCore.source
    });

    const axeResults = await page.evaluate(async () => {
      const axe = (window as typeof window & {
        axe: {
          run: (node?: Element | Document, options?: Record<string, unknown>) => Promise<Record<string, unknown>>;
        };
      }).axe;

      return axe.run(document, {
        runOnly: {
          type: "tag",
          values: ["wcag2a", "wcag2aa", "best-practice"]
        }
      });
    });

    const pa11yIssues = pa11yResults.issues.map((issue: any) => ({
      source: "pa11y",
      code: issue.code,
      message: issue.message,
      selector: issue.selector,
      type: issue.type,
      typeCode: issue.typeCode,
      severity: mapImpactToSeverity(issue.type)
    }));

    const axeViolations = ((axeResults.violations as Array<Record<string, unknown>>) ?? []).map(
      (violation) => ({
        source: "axe",
        id: violation.id,
        impact: violation.impact,
        description: violation.description,
        help: violation.help,
        helpUrl: violation.helpUrl,
        nodes: Array.isArray(violation.nodes) ? violation.nodes.length : 0,
        severity: mapImpactToSeverity((violation.impact as string | undefined) ?? null)
      })
    );

    const issues: ScanIssue[] = [
      ...pa11yIssues.slice(0, 10).map((issue: any, index: number) => ({
        id: `pa11y-${index}`,
        title: issue.code,
        description: issue.message,
        severity: issue.severity,
        metric: issue.selector
      })),
      ...axeViolations.slice(0, 10).map((violation, index) => ({
        id: `axe-${index}`,
        title: String(violation.help ?? violation.id ?? "Accessibility violation"),
        description: String(violation.description ?? "A WCAG violation was detected."),
        severity: violation.severity,
        metric: `${violation.nodes} affected node(s)`
      }))
    ];

    const recommendations: ScanRecommendation[] = axeViolations.slice(0, 10).map((violation, index) => ({
      id: `accessibility-rec-${index}`,
      title: String(violation.help ?? "Fix accessibility issue"),
      description: String(violation.description ?? "Review and resolve this accessibility issue."),
      priority: violation.severity,
      link: typeof violation.helpUrl === "string" ? violation.helpUrl : null
    }));

    return {
      accessibilityViolations: [...pa11yIssues, ...axeViolations],
      issues,
      recommendations,
      raw: {
        pa11y: pa11yResults,
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
