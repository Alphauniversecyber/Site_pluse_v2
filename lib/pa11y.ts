import "server-only";

import axeCore from "axe-core";
import pa11y from "pa11y";
import puppeteer from "puppeteer";

import type { ScanIssue, ScanRecommendation } from "@/types";

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
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;

  try {
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
    return {
      accessibilityViolations: [] as Array<Record<string, unknown>>,
      issues: [] as ScanIssue[],
      recommendations: [] as ScanRecommendation[],
      raw: {
        error: error instanceof Error ? error.message : "Accessibility scan failed."
      },
      error: error instanceof Error ? error.message : "Accessibility scan failed."
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
