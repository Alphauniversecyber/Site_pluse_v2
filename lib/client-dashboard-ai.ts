import "server-only";

import Groq from "groq-sdk";

import type { GaDashboardData, GscDashboardData } from "@/types";

const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;
const MODEL = "llama-3.3-70b-versatile";

const ISSUES_SYSTEM_PROMPT =
  "You are a website performance and SEO analyst. You will receive technical audit data for a website. Your job is to identify the most important problems affecting this business's online visibility and revenue. Write in plain English — avoid raw technical terms. Instead of 'LCP is 4.2s', say 'Your main page content takes too long to load, which causes visitors to leave before it appears.' Focus on business impact. Return ONLY a valid JSON array with no markdown, no explanation. Each object: { title, severity, description, impact, category }";

const RECOMMENDATIONS_SYSTEM_PROMPT =
  "You are a digital growth strategist. You will receive technical audit data and optionally live traffic data for a website. Your job is to provide clear, actionable recommendations that will grow this business's online traffic, engagement, and conversions. Write in plain English — what to do, why it matters, what result to expect. Return ONLY a valid JSON array with no markdown, no explanation. Each object: { title, priority, description, expectedResult, effort, category }";

export type ClientAiIssue = {
  title: string;
  severity: "critical" | "warning" | "info";
  description: string;
  impact: string;
  category: string;
};

export type ClientAiRecommendation = {
  title: string;
  priority: "high" | "medium" | "low";
  description: string;
  expectedResult: string;
  effort: "low" | "medium" | "high";
  category: string;
};

type AuditDataPayload = {
  overview?: Record<string, unknown>;
  issues?: Array<Record<string, unknown>>;
  recommendations?: Array<Record<string, unknown>>;
  rawData?: Record<string, unknown>;
} | null;

function getGroqClient() {
  if (!groq) {
    throw new Error("Missing GROQ_API_KEY.");
  }

  return groq;
}

function extractJsonArray(text: string) {
  const clean = text.replace(/```json|```/g, "").trim();
  const firstBracket = clean.indexOf("[");
  const lastBracket = clean.lastIndexOf("]");

  if (firstBracket === -1 || lastBracket === -1 || lastBracket < firstBracket) {
    throw new Error("Groq did not return a JSON array.");
  }

  return JSON.parse(clean.slice(firstBracket, lastBracket + 1)) as Array<Record<string, unknown>>;
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

function normalizeRecommendationPriority(value: unknown): ClientAiRecommendation["priority"] {
  return value === "high" || value === "medium" || value === "low" ? value : "medium";
}

function normalizeRecommendationEffort(value: unknown): ClientAiRecommendation["effort"] {
  return value === "low" || value === "medium" || value === "high" ? value : "medium";
}

function sanitizeIssue(item: Record<string, unknown>): ClientAiIssue {
  return {
    title: sanitizeText(item.title, "Issue identified"),
    severity: normalizeIssueSeverity(item.severity),
    description: sanitizeText(item.description, "This issue needs attention."),
    impact: sanitizeText(item.impact, "This is reducing the website's ability to win trust, traffic, or leads."),
    category: sanitizeText(item.category, "general")
  };
}

function sanitizeRecommendation(item: Record<string, unknown>): ClientAiRecommendation {
  return {
    title: sanitizeText(item.title, "Recommendation"),
    priority: normalizeRecommendationPriority(item.priority),
    description: sanitizeText(item.description, "This is a worthwhile improvement to plan next."),
    expectedResult: sanitizeText(item.expectedResult, "This should improve visibility, engagement, or conversions."),
    effort: normalizeRecommendationEffort(item.effort),
    category: sanitizeText(item.category, "general")
  };
}

function buildUserPayload(input: {
  token: string;
  auditData: AuditDataPayload;
  gscData?: GscDashboardData | null;
  ga4Data?: GaDashboardData | null;
}) {
  return JSON.stringify(
    {
      token: input.token,
      auditData: input.auditData,
      gscData: input.gscData ?? null,
      ga4Data: input.ga4Data ?? null
    },
    null,
    2
  );
}

export async function analyzeClientIssues(input: {
  token: string;
  auditData: AuditDataPayload;
  gscData?: GscDashboardData | null;
  ga4Data?: GaDashboardData | null;
}) {
  const client = getGroqClient();
  const completion = await client.chat.completions.create({
    model: MODEL,
    temperature: 0.2,
    response_format: { type: "json_object" as const },
    messages: [
      { role: "system", content: ISSUES_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Return a JSON object with one key named "issues" whose value is the required JSON array.\n${buildUserPayload(
          input
        )}`
      }
    ]
  });

  const content = completion.choices[0]?.message?.content ?? '{"issues":[]}';
  const parsed = JSON.parse(content) as { issues?: Array<Record<string, unknown>> };

  return Array.isArray(parsed.issues) ? parsed.issues.map(sanitizeIssue) : extractJsonArray(content).map(sanitizeIssue);
}

export async function analyzeClientRecommendations(input: {
  token: string;
  auditData: AuditDataPayload;
  gscData?: GscDashboardData | null;
  ga4Data?: GaDashboardData | null;
}) {
  const client = getGroqClient();
  const completion = await client.chat.completions.create({
    model: MODEL,
    temperature: 0.2,
    response_format: { type: "json_object" as const },
    messages: [
      { role: "system", content: RECOMMENDATIONS_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Return a JSON object with one key named "recommendations" whose value is the required JSON array.\n${buildUserPayload(
          input
        )}`
      }
    ]
  });

  const content = completion.choices[0]?.message?.content ?? '{"recommendations":[]}';
  const parsed = JSON.parse(content) as { recommendations?: Array<Record<string, unknown>> };

  return Array.isArray(parsed.recommendations)
    ? parsed.recommendations.map(sanitizeRecommendation)
    : extractJsonArray(content).map(sanitizeRecommendation);
}
