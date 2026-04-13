import "server-only";

import { createHash } from "node:crypto";

import Groq from "groq-sdk";

const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;

const cache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 60 * 60 * 1000;

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

function stripMarkdownLinks(value: string) {
  return value.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").trim();
}

function sanitizeIssue(input: RawIssue): RawIssue {
  return {
    ...input,
    title: stripMarkdownLinks(input.title),
    description: stripMarkdownLinks(input.description)
  };
}

function sanitizeRecommendation(input: RawRecommendation): RawRecommendation {
  return {
    ...input,
    title: stripMarkdownLinks(input.title),
    description: stripMarkdownLinks(input.description)
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
    title: stripMarkdownLinks(String(item.title ?? "")).slice(0, 120) || "Issue needs review",
    description: stripMarkdownLinks(String(item.description ?? "")) || "This issue needs review.",
    whatToDo: stripMarkdownLinks(String(item.whatToDo ?? "")) || "Ask your developer to review this issue.",
    realWorldImpact:
      stripMarkdownLinks(String(item.realWorldImpact ?? "")) ||
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
    title: stripMarkdownLinks(String(item.title ?? "")).slice(0, 120) || "Recommendation",
    whatToDo: stripMarkdownLinks(String(item.whatToDo ?? "")) || "Ask your developer to review this recommendation.",
    whyItMatters:
      stripMarkdownLinks(String(item.whyItMatters ?? "")) ||
      "This will help improve your website's performance and visibility.",
    estimatedTime: stripMarkdownLinks(String(item.estimatedTime ?? "")) || "~30 mins",
    effort: normalizeRecommendationEffort(String(item.effort ?? ""))
  };
}

function assertGroqConfigured() {
  if (!groq) {
    throw new Error("Missing GROQ_API_KEY.");
  }
}

export async function rewriteIssuesToPlainEnglish(issues: RawIssue[]): Promise<PlainEnglishIssue[]> {
  const sanitized = issues.map(sanitizeIssue);
  const cacheKey = getCacheKey("issues", sanitized);
  const cached = getCached<PlainEnglishIssue[]>(cacheKey);

  if (cached) {
    return cached;
  }

  assertGroqConfigured();

  const prompt = `
You are an SEO expert who explains technical website issues
to non-technical business owners in plain, friendly English.

Rewrite each of these SEO/performance issues into plain English.
Strip all markdown links like [text](url) completely.
Remove all technical jargon.
Make it sound like a friendly expert talking to a business owner.

For each issue return:
- title: short clear title (max 8 words, action oriented)
- description: 2 sentences max, plain English, no jargon
- whatToDo: 1-2 sentences, simple action the owner can take or ask dev to do
- realWorldImpact: 1 sentence starting with "This means..." explaining business impact
- category: one of: performance, seo, accessibility, security, best_practices
- icon: single emoji that represents the category

Issues to rewrite:
${JSON.stringify(sanitized, null, 2)}

Return ONLY a valid JSON array. No markdown, no explanation, no backticks.
`.trim();

  const completion = await groq.chat.completions.create({
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
}

export async function rewriteRecommendationsToPlainEnglish(
  recommendations: RawRecommendation[]
): Promise<PlainEnglishRecommendation[]> {
  const sanitized = recommendations.map(sanitizeRecommendation);
  const cacheKey = getCacheKey("recommendations", sanitized);
  const cached = getCached<PlainEnglishRecommendation[]>(cacheKey);

  if (cached) {
    return cached;
  }

  assertGroqConfigured();

  const prompt = `
You are an SEO expert explaining website improvements to
non-technical business owners in plain, friendly English.

Rewrite each recommendation into plain English.
Strip all markdown links like [text](url) completely.
No technical jargon. Sound like a friendly expert.

For each recommendation return:
- title: short action-oriented title (max 8 words)
- whatToDo: 2-3 sentences, simple steps in plain English
- whyItMatters: 1 sentence, real business benefit
- estimatedTime: realistic time estimate like "~15 mins" or "~1 hour" or "~1 day"
- effort: one of: Easy, Medium, Hard

Recommendations to rewrite:
${JSON.stringify(sanitized, null, 2)}

Return ONLY a valid JSON array. No markdown, no explanation, no backticks.
`.trim();

  const completion = await groq.chat.completions.create({
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
}
