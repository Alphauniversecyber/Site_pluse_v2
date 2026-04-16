import "server-only";

import { createHash } from "node:crypto";

import Groq from "groq-sdk";

const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;

const cache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 60 * 60 * 1000;

export function stripMarkdown(text: string | null | undefined): string {
  if (!text) {
    return "";
  }

  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/https?:\/\/[^\s)]+/g, "")
    .replace(/\[|\]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export interface PlainEnglishIssue {
  title: string;
  description: string;
  whatToDo: string;
  realWorldImpact: string;
  category: "performance" | "seo" | "accessibility" | "security" | "best_practices";
  icon: string;
}

export interface PlainEnglishRecommendation {
  title: string;
  whatToDo: string;
  whyItMatters: string;
  estimatedTime: string;
  effort: "Easy" | "Medium" | "Hard";
}

type RawIssue = {
  title: string;
  description: string;
  severity: string;
};

type RawRecommendation = {
  title: string;
  description: string;
  priority: string;
};

function sanitizeIssue(input: RawIssue): RawIssue {
  return {
    ...input,
    title: stripMarkdown(input.title),
    description: stripMarkdown(input.description)
  };
}

function sanitizeRecommendation(input: RawRecommendation): RawRecommendation {
  return {
    ...input,
    title: stripMarkdown(input.title),
    description: stripMarkdown(input.description)
  };
}

function getCacheKey(prefix: string, items: unknown) {
  return `${prefix}:${createHash("sha256").update(JSON.stringify(items)).digest("hex")}`;
}

function getCached<T>(key: string) {
  const cached = cache.get(key);

  if (!cached) {
    return null;
  }

  if (Date.now() - cached.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }

  return cached.data as T;
}

function setCached(key: string, data: unknown) {
  cache.set(key, {
    data,
    timestamp: Date.now()
  });
}

function normalizeIssueCategory(value: string): PlainEnglishIssue["category"] {
  if (value === "performance" || value === "seo" || value === "accessibility" || value === "security") {
    return value;
  }

  return "best_practices";
}

function normalizeIssueIcon(value: string, category: PlainEnglishIssue["category"]) {
  if (value.trim()) {
    return value.trim().slice(0, 2);
  }

  if (category === "performance") return "⚡";
  if (category === "seo") return "🔎";
  if (category === "accessibility") return "♿";
  if (category === "security") return "🔒";
  return "⚠️";
}

function normalizeIssue(item: Partial<PlainEnglishIssue>): PlainEnglishIssue {
  const category = normalizeIssueCategory(String(item.category ?? ""));

  return {
    title: stripMarkdown(String(item.title ?? "")).slice(0, 120) || "Issue needs review",
    description: stripMarkdown(String(item.description ?? "")) || "This issue needs review.",
    whatToDo: stripMarkdown(String(item.whatToDo ?? "")) || "Ask your developer to review this issue.",
    realWorldImpact:
      stripMarkdown(String(item.realWorldImpact ?? "")) ||
      "This means your website may be harder to use, find, or trust.",
    category,
    icon: normalizeIssueIcon(String(item.icon ?? ""), category)
  };
}

function normalizeRecommendationEffort(value: string): PlainEnglishRecommendation["effort"] {
  if (value === "Easy" || value === "Medium" || value === "Hard") {
    return value;
  }

  return "Medium";
}

function normalizeRecommendation(item: Partial<PlainEnglishRecommendation>): PlainEnglishRecommendation {
  return {
    title: stripMarkdown(String(item.title ?? "")).slice(0, 120) || "Recommendation",
    whatToDo: stripMarkdown(String(item.whatToDo ?? "")) || "Ask your developer to review this recommendation.",
    whyItMatters:
      stripMarkdown(String(item.whyItMatters ?? "")) ||
      "This will help improve your website's performance and visibility.",
    estimatedTime: stripMarkdown(String(item.estimatedTime ?? "")) || "~30 mins",
    effort: normalizeRecommendationEffort(String(item.effort ?? ""))
  };
}

function getGroqClient(): Groq {
  if (!groq) {
    throw new Error("Missing GROQ_API_KEY.");
  }

  return groq;
}

export async function rewriteIssuesToPlainEnglish(issues: RawIssue[]): Promise<PlainEnglishIssue[]> {
  const cleanedIssues = issues.map(sanitizeIssue);
  const cacheKey = getCacheKey("issues", cleanedIssues);
  const cached = getCached<PlainEnglishIssue[]>(cacheKey);

  if (cached) {
    return cached;
  }

  try {
    const groqClient = getGroqClient();
    const prompt = `
You are rewriting website review findings for a client dashboard used by
busy business owners and account managers.

Rewrite each issue in clear, practical language.
Strip all markdown links like [text](url).
Avoid jargon, acronyms, and audit-style wording unless it is commonly understood.
Make it sound like a calm expert explaining what matters to the business.

For each issue return:
- title: short clear title (max 8 words, action oriented)
- description: 2 sentences max, plain English, no jargon
- whatToDo: 1-2 sentences with the next sensible action for the team
- realWorldImpact: 1 sentence explaining the business impact in terms of trust, leads, sales, or visibility
- category: one of: performance, seo, accessibility, security, best_practices
- icon: a short category label

Issues to rewrite:
${JSON.stringify(cleanedIssues, null, 2)}

Return ONLY a valid JSON array. No markdown, no explanation, no backticks.
`.trim();

    const completion = await groqClient.chat.completions.create({
      model: "llama3-8b-8192",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 4000
    });

    const text = completion.choices[0]?.message?.content ?? "[]";
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean) as Array<Partial<PlainEnglishIssue>>;
    const normalized = parsed.map(normalizeIssue);

    setCached(cacheKey, normalized);
    return normalized;
  } catch {
    return cleanedIssues.map((issue) => ({
      title: stripMarkdown(issue.title),
      description: stripMarkdown(issue.description),
      whatToDo: "Ask your web partner to review this in the next update cycle and confirm when it is fixed.",
      realWorldImpact: "This can make the site harder to find, use, or trust, which may lower enquiries and sales.",
      category: "best_practices" as const,
      icon: "⚠️"
    }));
  }
}

export async function rewriteRecommendationsToPlainEnglish(
  recommendations: RawRecommendation[]
): Promise<PlainEnglishRecommendation[]> {
  const cleanedRecommendations = recommendations.map(sanitizeRecommendation);
  const cacheKey = getCacheKey("recommendations", cleanedRecommendations);
  const cached = getCached<PlainEnglishRecommendation[]>(cacheKey);

  if (cached) {
    return cached;
  }

  try {
    const groqClient = getGroqClient();
    const prompt = `
You are rewriting website improvement recommendations for a client dashboard.

Explain each recommendation in clear business language.
Strip all markdown links like [text](url).
Avoid jargon and make the advice easy to act on for non-technical readers.

For each recommendation return:
- title: short action-oriented title (max 8 words)
- whatToDo: 2-3 sentences, simple steps in plain English
- whyItMatters: 1 sentence focused on the business benefit
- estimatedTime: realistic time estimate like "~15 mins" or "~1 hour" or "~1 day"
- effort: one of: Easy, Medium, Hard

Recommendations to rewrite:
${JSON.stringify(cleanedRecommendations, null, 2)}

Return ONLY a valid JSON array. No markdown, no explanation, no backticks.
`.trim();

    const completion = await groqClient.chat.completions.create({
      model: "llama3-8b-8192",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 4000
    });

    const text = completion.choices[0]?.message?.content ?? "[]";
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean) as Array<Partial<PlainEnglishRecommendation>>;
    const normalized = parsed.map(normalizeRecommendation);

    setCached(cacheKey, normalized);
    return normalized;
  } catch {
    return cleanedRecommendations.map((rec) => ({
      title: stripMarkdown(rec.title),
      whatToDo: stripMarkdown(rec.description),
      whyItMatters: "This should improve the customer experience and strengthen the site's ability to turn traffic into results.",
      estimatedTime: "~30 mins",
      effort: "Medium" as const
    }));
  }
}
