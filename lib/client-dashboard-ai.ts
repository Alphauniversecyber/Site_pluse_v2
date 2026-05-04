import "server-only";

import type { GaDashboardData, GscDashboardData } from "@/types";

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";

const ISSUES_SYSTEM_PROMPT =
  "You are a website performance and SEO analyst. You will receive audit data for a website. Identify the most important problems hurting this business. Write in plain business English — no raw technical acronyms. Instead of 'LCP is 4.2s' say 'Your main page content takes too long to load, which causes visitors to leave.' Focus on business impact. Return ONLY a valid JSON array, no markdown, no explanation. Each object must have: title (string), severity ('critical'|'warning'|'info'), description (string, 1-2 sentences), impact (string, what this costs the business), category ('performance'|'seo'|'accessibility'|'technical')";

const RECOMMENDATIONS_SYSTEM_PROMPT =
  "You are a digital growth strategist. You will receive audit data and optionally live traffic data for a website. Provide clear, actionable recommendations to grow traffic, engagement, and conversions. Write in plain business English — what to do, why it matters, what result to expect. Return ONLY a valid JSON array, no markdown, no explanation. Each object must have: title (string), priority ('high'|'medium'|'low'), description (string, 1-2 sentences), expectedResult (string), effort ('low'|'medium'|'high'), category ('performance'|'seo'|'content'|'technical')";

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

type ClientAiInput = {
  token: string;
  auditData: AuditDataPayload;
  gscData?: GscDashboardData | null;
  ga4Data?: GaDashboardData | null;
};

export class ClientAiParseError extends Error {
  rawText: string;

  constructor(message: string, rawText: string) {
    super(message);
    this.name = "ClientAiParseError";
    this.rawText = rawText;
  }
}

function sanitizeText(value: unknown, fallback: string) {
  if (typeof value !== "string") {
    return fallback;
  }

  const cleaned = value.replace(/\s+/g, " ").trim();
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
    description: sanitizeText(item.description, "This issue needs attention."),
    impact: sanitizeText(item.impact, "This is costing the business visibility, trust, or leads."),
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

async function runGroqJsonArray(systemPrompt: string, auditPayload: ClientAiInput) {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("Missing GROQ_API_KEY.");
  }

  const groqPayload = {
    model: MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: JSON.stringify(auditPayload) }
    ],
    temperature: 0.4,
    max_tokens: 2000
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
  const parsed = await runGroqJsonArray(ISSUES_SYSTEM_PROMPT, input);
  return parsed.map(sanitizeIssue);
}

export async function analyzeClientRecommendations(input: ClientAiInput) {
  const parsed = await runGroqJsonArray(RECOMMENDATIONS_SYSTEM_PROMPT, input);
  return parsed.map(sanitizeRecommendation);
}
