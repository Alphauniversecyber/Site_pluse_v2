import "server-only";

import type { GaDashboardData, GscDashboardData } from "@/types";

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";

const ISSUES_SYSTEM_PROMPT =
  "You are a website performance and SEO analyst. You will receive audit data for a website. Identify the most important problems hurting this business. Write in plain business English - no raw technical acronyms. Instead of 'LCP is 4.2s' say 'Your main page content takes too long to load, which causes visitors to leave.' Focus on business impact. Every issue must have a unique description and a unique impact statement tied directly to that specific issue. Finish every sentence completely. Do not use markdown, backticks, placeholder copy, or the phrase 'Learn more about.' Return ONLY a valid JSON array, no markdown, no explanation. Each object must have: title (string), severity ('critical'|'warning'|'info'), description (string, 1-2 sentences), impact (string, what this costs the business), category ('performance'|'seo'|'accessibility'|'technical')";

const RECOMMENDATIONS_SYSTEM_PROMPT =
  "You are a digital growth strategist. You will receive audit data and optionally live traffic data for a website. Provide clear, actionable recommendations to grow traffic, engagement, and conversions. Write in plain business English - what to do, why it matters, what result to expect. Return ONLY a valid JSON array, no markdown, no explanation. Each object must have: title (string), priority ('high'|'medium'|'low'), description (string, 1-2 sentences), expectedResult (string), effort ('low'|'medium'|'high'), category ('performance'|'seo'|'content'|'technical')";

export type ClientAiIssue = {
  title: string;
  severity: "critical" | "warning" | "info";
  description: string;
  impact: string;
  category: "performance" | "seo" | "accessibility" | "technical";
};

export type ClientAiRecommendation = {
  title: string;
  priority: "high" | "medium" | "low";
  description: string;
  expectedResult: string;
  effort: "low" | "medium" | "high";
  category: "performance" | "seo" | "content" | "technical";
};

type AuditDataPayload = {
  overview?: Record<string, unknown>;
  issues?: Array<Record<string, unknown>>;
  recommendations?: Array<Record<string, unknown>>;
  rawData?: Record<string, unknown>;
} | null;

type SlimIssuePayload = {
  title: string;
  severity: "high" | "medium" | "low";
  metric: string | null;
};

type SlimRecommendationPayload = {
  title: string;
  priority: string | null;
  potentialSavingsSec: string;
};

export type SlimClientDashboardPayload = {
  scores: {
    performance: number | null;
    seo: number | null;
    accessibility: number | null;
    bestPractices: number | null;
  };
  vitals: {
    lcp: string | null;
    fcp: string | null;
    tbt: string | null;
    cls: number | null;
    tti: string | null;
    speedIndex: string | null;
  };
  topIssues: SlimIssuePayload[];
  topRecommendations: SlimRecommendationPayload[];
  gsc:
    | {
        connected: true;
        clicks28d: number;
        impressions28d: number;
        avgPosition: number;
        ctr: number;
        indexedPages: number;
        topQueries: Array<{
          query: string;
          clicks: number;
          position: number;
        }>;
      }
    | { connected: false };
  ga4:
    | {
        connected: true;
        sessions28d: number;
        bounceRate: number;
        avgSessionDurationSec: number;
        topPages: Array<{
          page: string;
          sessions: number;
        }>;
        topDevices: GaDashboardData["devices"];
        topCountries: string[];
      }
    | { connected: false };
};

type ClientAiInput = {
  slimPayload: SlimClientDashboardPayload;
};

export class ClientAiParseError extends Error {
  rawText: string;

  constructor(message: string, rawText: string) {
    super(message);
    this.name = "ClientAiParseError";
    this.rawText = rawText;
  }
}

class DuplicateIssueCopyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DuplicateIssueCopyError";
  }
}

function stripBrokenTemplateText(value: string) {
  return value
    .replace(/`+/g, "")
    .replace(/\bLearn more about\.(?=\s|$)/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function trimIncompleteTrailingSentence(value: string) {
  const cleaned = stripBrokenTemplateText(value);

  if (!cleaned) {
    return "";
  }

  if (/[.!?]$/.test(cleaned)) {
    return cleaned;
  }

  const completed = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .filter((sentence) => /[.!?]$/.test(sentence));

  if (completed.length) {
    return completed.join(" ").trim();
  }

  return cleaned.replace(/[,:;\-]+$/, "").trim();
}

function sanitizeText(value: unknown, fallback: string, options?: { completeSentence?: boolean }) {
  if (typeof value !== "string") {
    return fallback;
  }

  const cleaned = options?.completeSentence
    ? trimIncompleteTrailingSentence(value)
    : stripBrokenTemplateText(value);

  return cleaned || fallback;
}

function normalizeIssueSeverity(value: unknown): ClientAiIssue["severity"] {
  return value === "critical" || value === "warning" || value === "info" ? value : "info";
}

function normalizeIssueCategory(value: unknown): ClientAiIssue["category"] {
  return value === "performance" || value === "seo" || value === "accessibility" || value === "technical"
    ? value
    : "technical";
}

function normalizeRecommendationPriority(value: unknown): ClientAiRecommendation["priority"] {
  return value === "high" || value === "medium" || value === "low" ? value : "medium";
}

function normalizeRecommendationEffort(value: unknown): ClientAiRecommendation["effort"] {
  return value === "low" || value === "medium" || value === "high" ? value : "medium";
}

function normalizeRecommendationCategory(value: unknown): ClientAiRecommendation["category"] {
  return value === "performance" || value === "seo" || value === "content" || value === "technical"
    ? value
    : "technical";
}

function sanitizeIssue(item: Record<string, unknown>): ClientAiIssue {
  return {
    title: sanitizeText(item.title, "Issue identified"),
    severity: normalizeIssueSeverity(item.severity),
    description: sanitizeText(item.description, "This issue needs attention.", {
      completeSentence: true
    }),
    impact: sanitizeText(item.impact, "This is costing the business visibility, trust, or leads.", {
      completeSentence: true
    }),
    category: normalizeIssueCategory(item.category)
  };
}

function sanitizeRecommendation(item: Record<string, unknown>): ClientAiRecommendation {
  return {
    title: sanitizeText(item.title, "Recommendation"),
    priority: normalizeRecommendationPriority(item.priority),
    description: sanitizeText(item.description, "This is a useful next step for the site."),
    expectedResult: sanitizeText(
      item.expectedResult,
      "This should improve traffic, engagement, or conversions."
    ),
    effort: normalizeRecommendationEffort(item.effort),
    category: normalizeRecommendationCategory(item.category)
  };
}

function parseGroqJsonArray(text: string) {
  const clean = text.replace(/```json/g, "").replace(/```/g, "").trim();
  return JSON.parse(clean) as Array<Record<string, unknown>>;
}

function validateIssueCopyUniqueness(issues: ClientAiIssue[]) {
  const descriptionCounts = new Map<string, number>();
  const impactCounts = new Map<string, number>();

  for (const issue of issues) {
    const normalizedDescription = stripBrokenTemplateText(issue.description).toLowerCase();
    const normalizedImpact = stripBrokenTemplateText(issue.impact).toLowerCase();

    if (normalizedDescription) {
      descriptionCounts.set(
        normalizedDescription,
        (descriptionCounts.get(normalizedDescription) ?? 0) + 1
      );
    }

    if (normalizedImpact) {
      impactCounts.set(normalizedImpact, (impactCounts.get(normalizedImpact) ?? 0) + 1);
    }
  }

  if (
    Array.from(descriptionCounts.values()).some((count) => count >= 2) ||
    Array.from(impactCounts.values()).some((count) => count >= 2)
  ) {
    throw new DuplicateIssueCopyError("AI returned duplicate issue body text.");
  }
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function normalizeSlimSeverity(value: unknown): SlimIssuePayload["severity"] {
  return value === "high" || value === "medium" || value === "low" ? value : "low";
}

export function buildSlimPayload(
  auditData: AuditDataPayload,
  gscData?: GscDashboardData | null,
  ga4Data?: GaDashboardData | null
): SlimClientDashboardPayload {
  const severityRank = { high: 3, medium: 2, low: 1 } as const;
  const overview = auditData?.overview ?? {};
  const seenTitles = new Map<string, { title: string; severity: SlimIssuePayload["severity"]; metric: string | null }>();

  for (const issue of auditData?.issues ?? []) {
    const title = asString(issue.title);

    if (!title) {
      continue;
    }

    const normalizedIssue = {
      title,
      severity: normalizeSlimSeverity(issue.severity),
      metric: asString(issue.metric)
    };
    const existing = seenTitles.get(normalizedIssue.title);

    if (!existing || severityRank[normalizedIssue.severity] > severityRank[existing.severity]) {
      seenTitles.set(normalizedIssue.title, normalizedIssue);
    }
  }

  const uniqueIssues = Array.from(seenTitles.values())
    .sort((a, b) => severityRank[b.severity] - severityRank[a.severity])
    .slice(0, 10)
    .map((issue) => ({
      title: issue.title,
      severity: issue.severity,
      metric: issue.metric ?? null
    }));

  const seenRecs = new Map<
    string,
    { title: string; priority: string | null; potentialSavingsMs: number }
  >();

  for (const rec of auditData?.recommendations ?? []) {
    const title = asString(rec.title);

    if (!title) {
      continue;
    }

    const normalizedRec = {
      title,
      priority: asString(rec.priority),
      potentialSavingsMs: asNumber(rec.potentialSavingsMs) ?? 0
    };
    const existing = seenRecs.get(normalizedRec.title);

    if (!existing || normalizedRec.potentialSavingsMs > existing.potentialSavingsMs) {
      seenRecs.set(normalizedRec.title, normalizedRec);
    }
  }

  const uniqueRecs = Array.from(seenRecs.values())
    .sort((a, b) => b.potentialSavingsMs - a.potentialSavingsMs)
    .slice(0, 8)
    .map((rec) => ({
      title: rec.title,
      priority: rec.priority,
      potentialSavingsSec:
        rec.potentialSavingsMs > 1000
          ? `${(rec.potentialSavingsMs / 1000).toFixed(1)}s`
          : `${rec.potentialSavingsMs}ms`
    }));

  const gscSummary =
    gscData?.connected
      ? {
          connected: true as const,
          clicks28d: gscData.summary.clicks,
          impressions28d: gscData.summary.impressions,
          avgPosition: gscData.summary.avgPosition,
          ctr: gscData.summary.ctr,
          indexedPages: gscData.summary.indexedPages,
          topQueries: (gscData.topQueries ?? []).slice(0, 5).map((query) => ({
            query: query.query,
            clicks: query.clicks,
            position: query.position
          }))
        }
      : { connected: false as const };

  const ga4Summary =
    ga4Data?.connected
      ? {
          connected: true as const,
          sessions28d: ga4Data.summary.sessions,
          bounceRate: ga4Data.summary.bounceRate,
          avgSessionDurationSec: Math.round(ga4Data.summary.averageSessionDuration),
          topPages: (ga4Data.topPages ?? []).slice(0, 5).map((page) => ({
            page: page.page,
            sessions: page.sessions
          })),
          topDevices: (ga4Data.devices ?? []).slice(0, 3),
          topCountries: (ga4Data.countries ?? [])
            .slice(0, 5)
            .map((country) => {
              const countryName = (country as { country?: string | null; name?: string | null }).country;
              const fallbackName = (country as { country?: string | null; name?: string | null }).name;
              return countryName ?? fallbackName ?? "";
            })
        }
      : { connected: false as const };

  return {
    scores: {
      performance: asNumber(overview.performance),
      seo: asNumber(overview.seo),
      accessibility: asNumber(overview.accessibility),
      bestPractices: asNumber(overview.bestPractices)
    },
    vitals: {
      lcp: asNumber(overview.lcp) ? `${(Number(overview.lcp) / 1000).toFixed(2)}s` : null,
      fcp: asNumber(overview.fcp) ? `${(Number(overview.fcp) / 1000).toFixed(2)}s` : null,
      tbt: asNumber(overview.tbt) ? `${Number(overview.tbt)}ms` : null,
      cls: asNumber(overview.cls),
      tti: asNumber(overview.tti) ? `${(Number(overview.tti) / 1000).toFixed(2)}s` : null,
      speedIndex: asNumber(overview.speedIndex)
        ? `${(Number(overview.speedIndex) / 1000).toFixed(2)}s`
        : null
    },
    topIssues: uniqueIssues,
    topRecommendations: uniqueRecs,
    gsc: gscSummary,
    ga4: ga4Summary
  };
}

async function runGroqJsonArray(systemPrompt: string, slimPayload: SlimClientDashboardPayload) {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("Missing GROQ_API_KEY.");
  }

  const slimPayloadJson = JSON.stringify(slimPayload);
  console.log("[client-dashboard-ai] slim payload size", slimPayloadJson.length);

  const groqPayload = {
    model: MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: slimPayloadJson }
    ],
    temperature: 0.4,
    max_tokens: 2800
  };

  console.log("[client-dashboard-ai] sending payload to Groq", groqPayload);

  const response = await fetch(GROQ_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(groqPayload)
  });

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
    error?: unknown;
  };
  const text = data.choices?.[0]?.message?.content ?? "";

  console.log("[client-dashboard-ai] raw Groq response", {
    status: response.status,
    data,
    text
  });

  if (!response.ok) {
    throw new Error(`Groq request failed with status ${response.status}.`);
  }

  try {
    return parseGroqJsonArray(text);
  } catch (error) {
    console.error("[client-dashboard-ai] failed to parse Groq JSON", {
      error,
      rawText: text
    });
    throw new ClientAiParseError("Unable to parse Groq JSON response.", text);
  }
}

export async function analyzeClientIssues(input: ClientAiInput) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parsed = await runGroqJsonArray(ISSUES_SYSTEM_PROMPT, input.slimPayload);
    const issues = parsed.map(sanitizeIssue);

    try {
      validateIssueCopyUniqueness(issues);
      return issues;
    } catch (error) {
      if (!(error instanceof DuplicateIssueCopyError) || attempt === 1) {
        throw error;
      }
    }
  }

  throw new Error("Unable to analyze issues right now.");
}

export async function analyzeClientRecommendations(input: ClientAiInput) {
  const parsed = await runGroqJsonArray(RECOMMENDATIONS_SYSTEM_PROMPT, input.slimPayload);
  return parsed.map(sanitizeRecommendation);
}
