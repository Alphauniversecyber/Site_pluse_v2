import "server-only";

import { createHash } from "node:crypto";

import Groq from "groq-sdk";
import type { ClientDashboardRewriteContext } from "@/types";

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
  id: string;
  title: string;
  description: string;
  severity: string;
};

type RawRecommendation = {
  id: string;
  title: string;
  description: string;
  priority: string;
};

type SanitizedRewriteContext = ClientDashboardRewriteContext;

function stripMarkdown(text: string | null | undefined): string {
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

function sanitizeIssue(input: RawIssue): RawIssue {
  return {
    ...input,
    id: stripMarkdown(input.id),
    title: stripMarkdown(input.title),
    description: stripMarkdown(input.description)
  };
}

function sanitizeRecommendation(input: RawRecommendation): RawRecommendation {
  return {
    ...input,
    id: stripMarkdown(input.id),
    title: stripMarkdown(input.title),
    description: stripMarkdown(input.description)
  };
}

function sanitizeRewriteContext(
  context?: ClientDashboardRewriteContext | null
): SanitizedRewriteContext | null {
  if (!context) {
    return null;
  }

  return {
    websiteUrl: stripMarkdown(context.websiteUrl),
    includeGoogleInsights: Boolean(context.includeGoogleInsights),
    gsc: {
      connected: Boolean(context.gsc?.connected),
      live: Boolean(context.includeGoogleInsights && context.gsc?.live),
      summary: {
        clicks: Number(context.gsc?.summary?.clicks ?? 0),
        impressions: Number(context.gsc?.summary?.impressions ?? 0),
        ctr: Number(context.gsc?.summary?.ctr ?? 0),
        avgPosition: Number(context.gsc?.summary?.avgPosition ?? 0)
      },
      topQueries: (context.gsc?.topQueries ?? []).slice(0, 5).map((query) => ({
        query: stripMarkdown(query.query).slice(0, 120),
        clicks: Number(query.clicks ?? 0),
        impressions: Number(query.impressions ?? 0),
        ctr: Number(query.ctr ?? 0),
        position: Number(query.position ?? 0)
      })),
      topPages: (context.gsc?.topPages ?? []).slice(0, 5).map((page) => ({
        page: stripMarkdown(page.page).slice(0, 120) || "/",
        clicks: Number(page.clicks ?? 0),
        impressions: Number(page.impressions ?? 0),
        ctr: Number(page.ctr ?? 0),
        position: Number(page.position ?? 0)
      }))
    },
    ga: {
      connected: Boolean(context.ga?.connected),
      live: Boolean(context.includeGoogleInsights && context.ga?.live),
      summary: {
        sessions: Number(context.ga?.summary?.sessions ?? 0),
        bounceRate: Number(context.ga?.summary?.bounceRate ?? 0),
        averageSessionDuration: Number(context.ga?.summary?.averageSessionDuration ?? 0)
      },
      topPages: (context.ga?.topPages ?? []).slice(0, 5).map((page) => ({
        page: stripMarkdown(page.page).slice(0, 120) || "/",
        sessions: Number(page.sessions ?? 0),
        bounceRate: Number(page.bounceRate ?? 0),
        averageSessionDuration: Number(page.averageSessionDuration ?? 0)
      }))
    }
  };
}

function getCacheKey(prefix: string, payload: unknown) {
  return `${prefix}:${createHash("sha256").update(JSON.stringify(payload)).digest("hex")}`;
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

function normalizeIssue(item: Partial<PlainEnglishIssue>): PlainEnglishIssue {
  const category = normalizeIssueCategory(String(item.category ?? ""));

  return {
    title: stripMarkdown(String(item.title ?? "")).slice(0, 120) || "Issue needs review",
    description: stripMarkdown(String(item.description ?? "")) || "This issue needs review.",
    whatToDo: stripMarkdown(String(item.whatToDo ?? "")) || "This issue needs review.",
    realWorldImpact: stripMarkdown(String(item.realWorldImpact ?? "")) || "This issue needs review.",
    category,
    icon: stripMarkdown(String(item.icon ?? "")).slice(0, 2) || "BP"
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
    whatToDo: stripMarkdown(String(item.whatToDo ?? "")) || "This recommendation needs review.",
    whyItMatters: stripMarkdown(String(item.whyItMatters ?? "")) || "This recommendation needs review.",
    estimatedTime: stripMarkdown(String(item.estimatedTime ?? "")) || "~30 mins",
    effort: normalizeRecommendationEffort(String(item.effort ?? ""))
  };
}

function inferIssueCategory(issue: RawIssue): PlainEnglishIssue["category"] {
  const haystack = `${issue.id} ${issue.title} ${issue.description}`.toLowerCase();

  if (
    /(seo|meta|schema|search|crawl|index|sitemap|canonical|title tag|description tag|broken link|redirect)/.test(
      haystack
    )
  ) {
    return "seo";
  }

  if (/(accessib|aria|contrast|keyboard|screen reader|alt text|label)/.test(haystack)) {
    return "accessibility";
  }

  if (/(security|ssl|header|https|hsts|csp|x-frame|x-content|permission-policy)/.test(haystack)) {
    return "security";
  }

  if (
    /(performance|speed|lcp|cls|tbt|render|cache|script|image|font|payload|load|javascript|css|server response)/.test(
      haystack
    )
  ) {
    return "performance";
  }

  return "best_practices";
}

function fallbackIssue(item: RawIssue): PlainEnglishIssue {
  const rawDescription = stripMarkdown(item.description) || stripMarkdown(item.title) || "This item needs review.";

  return {
    title: stripMarkdown(item.title) || "Issue needs review",
    description: rawDescription,
    whatToDo: rawDescription,
    realWorldImpact: rawDescription,
    category: inferIssueCategory(item),
    icon: "BP"
  };
}

function fallbackRecommendation(item: RawRecommendation): PlainEnglishRecommendation {
  const rawDescription = stripMarkdown(item.description) || stripMarkdown(item.title) || "This item needs review.";
  const isHigh = item.priority === "high";
  const isMedium = item.priority === "medium";

  return {
    title: stripMarkdown(item.title) || "Recommendation",
    whatToDo: rawDescription,
    whyItMatters: rawDescription,
    estimatedTime: isHigh ? "~1 day" : isMedium ? "~1 hour" : "~30 mins",
    effort: isHigh ? "Hard" : isMedium ? "Medium" : "Easy"
  };
}

function formatDuration(seconds: number) {
  if (!seconds || seconds <= 0) {
    return "0 sec";
  }

  if (seconds < 60) {
    return `${Math.round(seconds)} sec`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);

  if (!remainingSeconds) {
    return `${minutes} min`;
  }

  return `${minutes} min ${remainingSeconds} sec`;
}

function buildPromptContext(context: SanitizedRewriteContext | null) {
  if (!context || !context.includeGoogleInsights) {
    return {
      note:
        "No live Google context is available for this rewrite. Do not mention Search Console, GA4, impressions, clicks, bounce rate, session duration, or missing integrations.",
      payload: {
        websiteUrl: context?.websiteUrl ?? "",
        googleInsightsEnabled: false
      }
    };
  }

  return {
    note:
      "Live Google context is available. Use it only when it clearly strengthens the business explanation for that specific item. Never invent numbers or mention data that is not included below.",
    payload: {
      websiteUrl: context.websiteUrl,
      googleInsightsEnabled: true,
      gsc: context.gsc.live
        ? {
            summary: context.gsc.summary,
            topQueries: context.gsc.topQueries,
            topPages: context.gsc.topPages
          }
        : null,
      ga: context.ga.live
        ? {
            summary: {
              sessions: context.ga.summary.sessions,
              bounceRate: context.ga.summary.bounceRate,
              averageSessionDurationSeconds: context.ga.summary.averageSessionDuration,
              averageSessionDurationLabel: formatDuration(context.ga.summary.averageSessionDuration)
            },
            topPages: context.ga.topPages.map((page) => ({
              ...page,
              averageSessionDurationLabel: formatDuration(page.averageSessionDuration)
            }))
          }
        : null
    }
  };
}

function getGroqClient(): Groq {
  if (!groq) {
    throw new Error("Missing GROQ_API_KEY.");
  }

  return groq;
}

export async function rewriteIssuesToPlainEnglish(
  issues: RawIssue[],
  context?: ClientDashboardRewriteContext | null
): Promise<PlainEnglishIssue[]> {
  const cleanedIssues = issues.map(sanitizeIssue);
  const cleanedContext = sanitizeRewriteContext(context);
  const cacheKey = getCacheKey("issues", {
    items: cleanedIssues,
    context: cleanedContext
  });
  const cached = getCached<PlainEnglishIssue[]>(cacheKey);

  if (cached) {
    return cached;
  }

  try {
    const groqClient = getGroqClient();
    const contextBlock = buildPromptContext(cleanedContext);
    const prompt = `
You are rewriting website review findings for a client dashboard used by
busy business owners and account managers.

Rewrite each issue in clear, practical business English.
Strip all markdown links like [text](url).
Avoid jargon, acronyms, and audit-style wording unless it is commonly understood.
Make it sound like a calm expert explaining what matters to the business.

Rules:
- Return one JSON object per input item, in the exact same order.
- Every item's description, whatToDo, and realWorldImpact must be unique to that exact issue.
- "realWorldImpact" must talk about traffic, leads, conversions, enquiries, sales, or trust.
- "whatToDo" must be a specific next action, not a repeat of the description.
- If the live Google context below clearly matches an SEO or performance issue, use the exact numbers provided to make the copy more concrete.
- Never invent numbers, pages, queries, or causes.
- Never mention missing integrations or missing data.
- If the Google context is not relevant to an item, ignore it and still write strong business-friendly copy from the issue itself.

For each issue return:
- title: short clear title (max 8 words, action oriented)
- description: 2 sentences max, plain English, no jargon
- whatToDo: 1-2 sentences with the next sensible action for the team
- realWorldImpact: 1 sentence explaining the business impact in terms of trust, leads, sales, or visibility
- category: one of: performance, seo, accessibility, security, best_practices
- icon: a short category label

Context instructions:
${contextBlock.note}

Website context:
${JSON.stringify(contextBlock.payload, null, 2)}

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
    const normalized = cleanedIssues.map((issue, index) =>
      normalizeIssue(parsed[index] ?? fallbackIssue(issue))
    );

    setCached(cacheKey, normalized);
    return normalized;
  } catch {
    return cleanedIssues.map(fallbackIssue);
  }
}

export async function rewriteRecommendationsToPlainEnglish(
  recommendations: RawRecommendation[],
  context?: ClientDashboardRewriteContext | null
): Promise<PlainEnglishRecommendation[]> {
  const cleanedRecommendations = recommendations.map(sanitizeRecommendation);
  const cleanedContext = sanitizeRewriteContext(context);
  const cacheKey = getCacheKey("recommendations", {
    items: cleanedRecommendations,
    context: cleanedContext
  });
  const cached = getCached<PlainEnglishRecommendation[]>(cacheKey);

  if (cached) {
    return cached;
  }

  try {
    const groqClient = getGroqClient();
    const contextBlock = buildPromptContext(cleanedContext);
    const prompt = `
You are rewriting website improvement recommendations for a client dashboard.

Explain each recommendation in clear business language.
Strip all markdown links like [text](url).
Avoid jargon and make the advice easy to act on for non-technical readers.

Rules:
- Return one JSON object per input item, in the exact same order.
- Each recommendation must have unique copy for title, whatToDo, and whyItMatters.
- "whyItMatters" must explain business impact in terms of traffic, leads, conversions, revenue, or trust.
- "whatToDo" must be a concrete action, not a restatement of the problem.
- If the live Google context below clearly matches an SEO or performance recommendation, use the exact numbers provided to make the copy more concrete.
- Never invent numbers, pages, queries, or causes.
- Never mention missing integrations or missing data.
- If the Google context is not relevant to an item, ignore it and still write strong business-friendly copy from the recommendation itself.

For each recommendation return:
- title: short action-oriented title (max 8 words)
- whatToDo: 2-3 sentences, simple steps in plain English
- whyItMatters: 1 sentence focused on the business benefit
- estimatedTime: realistic time estimate like "~15 mins" or "~1 hour" or "~1 day"
- effort: one of: Easy, Medium, Hard

Context instructions:
${contextBlock.note}

Website context:
${JSON.stringify(contextBlock.payload, null, 2)}

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
    const normalized = cleanedRecommendations.map((recommendation, index) =>
      normalizeRecommendation(parsed[index] ?? fallbackRecommendation(recommendation))
    );

    setCached(cacheKey, normalized);
    return normalized;
  } catch {
    return cleanedRecommendations.map(fallbackRecommendation);
  }
}
