import "server-only";

import { createHash } from "node:crypto";

import { z } from "zod";

import type {
  AgencyBranding,
  PlainLanguageCategory,
  PlainLanguageDifficulty,
  PlainLanguageIssue,
  PlainLanguageRawIssue,
  PlainLanguageRawRecommendation,
  PlainLanguageRecommendation,
  ReportAiCacheEntry,
  ScanIssue,
  ScanRecommendation,
  ScanResult,
  UserProfile,
  Website,
  WebsiteScanPlainEnglish
} from "@/types";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const GROQ_MODEL = "llama-3.3-70b-versatile";
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
const CACHE_TTL_HOURS = 24;
const SYSTEM_PROMPT =
  "You are a professional website health report generator, technical website auditor, and conversion analyst. Write for non-technical clients, but keep every statement strict, evidence-based, direct, and measurable. Do not use fluff, vague claims, or repeated explanations. Explain business impact in plain English and focus on traffic, conversions, engagement, trust, and revenue outcomes.";
const WEBSITE_DETAIL_SYSTEM_PROMPT =
  "You are an expert website consultant writing for non-technical business owners. Transform technical website issues into plain English. Never use technical terms like LCP, CLS, FID, TBT, DOM, API, CDN, HTTP, CSS, JS, render-blocking, or viewport. Always focus on business impact, client retention, conversions, trust, and revenue. Return ONLY valid JSON, nothing else.";
const BANNED_CLIENT_TERMS = /\b(LCP|FID|CLS|TBT|TTFB|INP|DOM|API|CDN|HTTP|CSS|JS|viewport)\b|render-blocking/gi;
const WEBSITE_DETAIL_TIME_OPTIONS = ["30 mins", "1-2 hours", "1-2 days", "1-2 weeks"] as const;

const reportIssueSchema = z.object({
  insight_id: z.string().min(1),
  title: z.string().min(1),
  priority: z.enum(["Critical", "High", "Medium", "Low"]),
  what_is_happening: z.string().min(1),
  why_it_matters: z.string().min(1),
  root_cause: z.string().min(1)
});

const reportRecommendationSchema = z.object({
  insight_id: z.string().min(1),
  title: z.string().min(1),
  action: z.string().min(1),
  expected_impact: z.string().min(1),
  effort: z.enum(["Easy", "Medium", "Hard"]),
  priority: z.enum(["Critical", "High", "Medium", "Low"])
});

const reportSectionsSchema = z.object({
  issues: z.array(reportIssueSchema),
  recommendations: z.array(reportRecommendationSchema)
});

const websiteDetailIssueSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  whats_happening: z.string().min(1),
  business_impact: z.string().min(1),
  how_to_fix: z.string().min(1),
  severity: z.enum(["high", "medium", "low"]),
  difficulty: z.enum(["Easy", "Medium", "Complex"]),
  time_estimate: z.enum(WEBSITE_DETAIL_TIME_OPTIONS),
  category: z.enum(["Performance", "SEO", "Accessibility", "Security"])
});

const websiteDetailRecommendationSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  difficulty: z.enum(["Easy", "Medium", "Complex"]),
  time_estimate: z.enum(WEBSITE_DETAIL_TIME_OPTIONS),
  priority: z.enum(["high", "medium", "low"])
});

const websiteDetailIssuesSchema = z.array(websiteDetailIssueSchema);
const websiteDetailRecommendationsSchema = z.array(websiteDetailRecommendationSchema);

const overviewSchema = z.object({
  overall_health: z.enum(["EXCELLENT", "GOOD", "NEEDS ATTENTION", "CRITICAL"]),
  executive_sentences: z.array(z.string().min(1)).length(2),
  score_summaries: z.object({
    performance: z.object({
      label: z.string().min(1),
      summary: z.string().min(1)
    }),
    seo: z.object({
      label: z.string().min(1),
      summary: z.string().min(1)
    }),
    accessibility: z.object({
      label: z.string().min(1),
      summary: z.string().min(1)
    }),
    best_practices: z.object({
      label: z.string().min(1),
      summary: z.string().min(1)
    })
  }),
  changes_summary: z.string().min(1),
  action_plan_title: z.string().min(1),
  action_plan_intro: z.string().min(1),
  action_plan: z
    .array(
      z.object({
        phase: z.string().min(1),
        focus: z.string().min(1),
        expected_result: z.string().min(1),
        tasks: z
          .array(
            z.object({
              task: z.string().min(1),
              time: z.string().min(1)
            })
          )
          .min(1)
          .max(4)
      })
    )
    .min(3)
    .max(4),
  projected_score_range: z.string().min(1),
  projected_summary: z.string().min(1),
  vitals_intro: z.string().min(1),
  vitals: z
    .array(
      z.object({
        title: z.string().min(1),
        value_label: z.string().min(1),
        status_label: z.string().min(1),
        explanation: z.string().min(1)
      })
    )
    .length(3),
  vitals_overall: z.string().min(1),
  device_intro: z.string().min(1),
  mobile_summary: z.string().min(1),
  desktop_summary: z.string().min(1),
  device_tip: z.string().min(1)
});

type OverviewNarrative = z.infer<typeof overviewSchema>;
export type ReportSectionIssue = z.infer<typeof reportIssueSchema>;
export type ReportSectionRecommendation = z.infer<typeof reportRecommendationSchema>;
type ReportSectionsPayload = z.infer<typeof reportSectionsSchema>;
export type ReportPriority = "Critical" | "High" | "Medium" | "Low";

type InsightCategory =
  | "speed-assets"
  | "speed-delivery"
  | "seo-snippets"
  | "seo-discovery"
  | "accessibility-content"
  | "accessibility-structure"
  | "stability"
  | "trust"
  | "other";

export type ReportInsight = {
  id: string;
  category: InsightCategory;
  title: string;
  technicalSummary: string;
  rootCause: string;
  severity: ScanIssue["severity"];
  priority: ReportPriority;
  scoreImpact: number;
  difficulty: ReportSectionRecommendation["effort"];
  timeToFix: string;
  device: "mobile" | "desktop" | "both" | null;
  relatedIssues: ScanIssue[];
  relatedRecommendations: ScanRecommendation[];
};

export type ReportIssueGroup = {
  title: "Fix This Week" | "Fix This Month" | "Nice To Have";
  color: string;
  emoji?: string;
  issues: Array<{
    insight: ReportInsight;
    ai: ReportSectionIssue;
  }>;
};

export type ReportRecommendationGroup = {
  title: "Fix This Week" | "Fix This Month" | "Nice To Have";
  color: string;
  emoji?: string;
  recommendations: Array<{
    insight: ReportInsight;
    ai: ReportSectionRecommendation;
  }>;
};

export type ReportNarrative = {
  provider: "groq" | "gemini" | "template";
  overview: OverviewNarrative;
  issues: ReportIssueGroup["issues"];
  recommendations: ReportRecommendationGroup["recommendations"];
  groupedIssues: ReportIssueGroup[];
  groupedRecommendations: ReportRecommendationGroup[];
};

function sanitizeClientText(value: string) {
  return value
    .replace(BANNED_CLIENT_TERMS, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,!?;:])/g, "$1")
    .trim();
}

function clampSentenceCount(value: string, count = 3) {
  const sentences = sanitizeClientText(value)
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean)
    .slice(0, count);

  return sentences.join(" ").trim();
}

function trimDanglingEnding(value: string) {
  let cleaned = sanitizeClientText(value).trim();
  const danglingWordPattern = /\b(?:and|but|to|for|the|your)\b$/i;

  while (danglingWordPattern.test(cleaned)) {
    cleaned = cleaned.replace(/\b(?:and|but|to|for|the|your)\b$/i, "").trim();
  }

  return cleaned.replace(/[,:;\-]+$/, "").trim();
}

function truncateToWordBoundary(value: string, maxLength: number) {
  const shortened = value.slice(0, Math.max(0, maxLength));
  const boundary = shortened.search(/\s+\S*$/);
  const safe = boundary > 24 ? shortened.slice(0, boundary) : shortened;
  return trimDanglingEnding(safe);
}

function completeSentenceWithinLimit(value: string, maxLength: number, sentenceCount = 3) {
  const clean = clampSentenceCount(value, sentenceCount);

  if (clean.length <= maxLength) {
    const completed = trimDanglingEnding(clean);
    return /[.!?]$/.test(completed) ? completed : `${completed}.`;
  }

  const sentenceFit = clean
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean)
    .reduce<string[]>((acc, sentence) => {
      const candidate = [...acc, sentence].join(" ").trim();
      return candidate.length <= maxLength ? [...acc, sentence] : acc;
    }, []);

  if (sentenceFit.length > 0) {
    return sentenceFit.join(" ").trim();
  }

  const fallback = truncateToWordBoundary(clean, maxLength);
  return /[.!?]$/.test(fallback) ? fallback : `${fallback}.`;
}

function truncateAtBoundary(value: string, maxLength: number, sentenceCount = 3) {
  const clean = clampSentenceCount(value, sentenceCount);

  if (clean.length <= maxLength) {
    return clean;
  }

  const sentenceFit = clean
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean)
    .reduce<string[]>((acc, sentence) => {
      const candidate = [...acc, sentence].join(" ").trim();
      return candidate.length <= maxLength ? [...acc, sentence] : acc;
    }, []);

  if (sentenceFit.length > 0) {
    return sentenceFit.join(" ").trim();
  }

  return truncateToWordBoundary(clean, maxLength);
}

function clampToThreeSentences(value: string) {
  return truncateAtBoundary(value, 220, 3);
}

function countWords(value: string) {
  return sanitizeClientText(value)
    .split(/\s+/)
    .filter(Boolean).length;
}

function ensureSentenceEnding(value: string) {
  const cleaned = trimDanglingEnding(value);
  if (!cleaned) {
    return "";
  }

  return /[.!?]$/.test(cleaned) ? cleaned : `${cleaned}.`;
}

function takeCompleteSentencesWithinWords(value: string, maxWords: number, sentenceCount = 2) {
  const sentences = clampSentenceCount(value, sentenceCount)
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => ensureSentenceEnding(sentence))
    .filter(Boolean);

  const fitted: string[] = [];

  for (const sentence of sentences) {
    const candidate = [...fitted, sentence].join(" ").trim();
    if (countWords(candidate) <= maxWords) {
      fitted.push(sentence);
    } else {
      break;
    }
  }

  return ensureSentenceEnding(fitted.join(" ").trim());
}

function takeWordsWithinLimit(value: string, maxWords: number) {
  const words = sanitizeClientText(value)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, maxWords)
    .join(" ");

  return ensureSentenceEnding(words);
}

function isProfessionalSubtitle(value: string) {
  return !/(fix issues!?|check vitals!?|check devices!?|great score!?)/i.test(value);
}

function meetsSentenceRules(
  value: string,
  minWords: number,
  maxWords: number,
  options?: {
    requireBusinessImpact?: boolean;
    requireMobileDesktop?: boolean;
    requireProfessional?: boolean;
  }
) {
  const cleaned = ensureSentenceEnding(value);
  const words = countWords(cleaned);

  if (!cleaned || words < minWords || words > maxWords || !/[.!?]$/.test(cleaned)) {
    return false;
  }

  if (/\b(?:and|but|to|for|the|your)[.!?]$/i.test(cleaned)) {
    return false;
  }

  if (
    options?.requireBusinessImpact &&
    !/\b(visitor|visitors|customer|customers|lead|leads|sale|sales|conversion|conversions|enquiries|enquiry|trust|ranking|rankings|business|revenue|traffic)\b/i.test(
      cleaned
    )
  ) {
    return false;
  }

  if (
    options?.requireMobileDesktop &&
    (!/\bmobile\b/i.test(cleaned) || !/\bdesktop\b/i.test(cleaned))
  ) {
    return false;
  }

  if (options?.requireProfessional && !isProfessionalSubtitle(cleaned)) {
    return false;
  }

  return true;
}

function enforceSentenceRange(
  value: string,
  fallback: string,
  minWords: number,
  maxWords: number,
  options?: {
    sentenceCount?: number;
    requireBusinessImpact?: boolean;
    requireMobileDesktop?: boolean;
    requireProfessional?: boolean;
  }
) {
  const sentenceCount = options?.sentenceCount ?? 2;
  const primary =
    takeCompleteSentencesWithinWords(value, maxWords, sentenceCount) ||
    takeWordsWithinLimit(value, maxWords);

  if (meetsSentenceRules(primary, minWords, maxWords, options)) {
    return primary;
  }

  const backup =
    takeCompleteSentencesWithinWords(fallback, maxWords, sentenceCount) ||
    takeWordsWithinLimit(fallback, maxWords);

  if (meetsSentenceRules(backup, minWords, maxWords, options)) {
    return backup;
  }

  return ensureSentenceEnding(trimDanglingEnding(fallback));
}

function sanitizeOverview(value: OverviewNarrative): OverviewNarrative {
  return {
    ...value,
    executive_sentences: value.executive_sentences.map((sentence) => completeSentenceWithinLimit(sentence, 80, 2)),
    score_summaries: {
      performance: {
        label: truncateAtBoundary(value.score_summaries.performance.label, 40, 1),
        summary: completeSentenceWithinLimit(value.score_summaries.performance.summary, 80, 1)
      },
      seo: {
        label: truncateAtBoundary(value.score_summaries.seo.label, 40, 1),
        summary: completeSentenceWithinLimit(value.score_summaries.seo.summary, 80, 1)
      },
      accessibility: {
        label: truncateAtBoundary(value.score_summaries.accessibility.label, 40, 1),
        summary: completeSentenceWithinLimit(value.score_summaries.accessibility.summary, 80, 1)
      },
      best_practices: {
        label: truncateAtBoundary(value.score_summaries.best_practices.label, 40, 1),
        summary: completeSentenceWithinLimit(value.score_summaries.best_practices.summary, 80, 1)
      }
    },
    changes_summary: completeSentenceWithinLimit(value.changes_summary, 80, 1),
    action_plan_title: truncateAtBoundary(value.action_plan_title, 60, 1),
    action_plan_intro: completeSentenceWithinLimit(value.action_plan_intro, 80, 1),
    action_plan: value.action_plan.map((week) => ({
      ...week,
      phase: sanitizeClientText(week.phase),
      focus: sanitizeClientText(week.focus),
      expected_result: completeSentenceWithinLimit(week.expected_result, 80, 1),
      tasks: week.tasks.map((task) => ({
        task: sanitizeClientText(task.task),
        time: sanitizeClientText(task.time)
      }))
    })),
    projected_score_range: truncateAtBoundary(value.projected_score_range, 30, 1),
    projected_summary: completeSentenceWithinLimit(value.projected_summary, 80, 1),
    vitals_intro: completeSentenceWithinLimit(value.vitals_intro, 80, 1),
    vitals: value.vitals.map((metric) => ({
      title: truncateAtBoundary(metric.title, 30, 1),
      value_label: truncateAtBoundary(metric.value_label, 30, 1),
      status_label: truncateAtBoundary(metric.status_label, 20, 1),
      explanation: completeSentenceWithinLimit(metric.explanation, 80, 1)
    })),
    vitals_overall: completeSentenceWithinLimit(value.vitals_overall, 80, 1),
    device_intro: completeSentenceWithinLimit(value.device_intro, 80, 1),
    mobile_summary: completeSentenceWithinLimit(value.mobile_summary, 80, 1),
    desktop_summary: completeSentenceWithinLimit(value.desktop_summary, 80, 1),
    device_tip: completeSentenceWithinLimit(value.device_tip, 80, 1)
  };
}

function sanitizeReportIssue(value: ReportSectionIssue): ReportSectionIssue {
  return {
    insight_id: sanitizeClientText(value.insight_id),
    title: truncateAtBoundary(value.title, 50, 1),
    priority: value.priority,
    what_is_happening: completeSentenceWithinLimit(value.what_is_happening, 80, 1),
    why_it_matters: completeSentenceWithinLimit(value.why_it_matters, 80, 1),
    root_cause: completeSentenceWithinLimit(value.root_cause, 80, 1)
  };
}

function sanitizeReportRecommendation(
  value: ReportSectionRecommendation
): ReportSectionRecommendation {
  return {
    insight_id: sanitizeClientText(value.insight_id),
    title: truncateAtBoundary(value.title, 50, 1),
    action: completeSentenceWithinLimit(value.action, 80, 1),
    expected_impact: completeSentenceWithinLimit(value.expected_impact, 80, 1),
    effort: value.effort,
    priority: value.priority
  };
}

function sanitizeReportSections(value: ReportSectionsPayload): ReportSectionsPayload {
  return {
    issues: value.issues.map(sanitizeReportIssue),
    recommendations: value.recommendations.map(sanitizeReportRecommendation)
  };
}

function fallbackIssueWhatText(insight: ReportInsight) {
  const templates: Record<InsightCategory, string> = {
    "speed-assets":
      "Large files and extra code are delaying important content, so visitors on both mobile and desktop wait too long before they can properly use the page.",
    "speed-delivery":
      "The website is not delivering pages efficiently, so visitors on both mobile and desktop spend longer waiting for content and key actions to appear.",
    "seo-snippets":
      "Important pages are missing strong search summaries, so visitors on both mobile and desktop may reach the site less often from Google results.",
    "seo-discovery":
      "Search engines are not getting the clearest signals from important pages, which affects how easily people find you on both mobile and desktop.",
    "accessibility-content":
      "Important buttons, links, or images are not clear enough, which makes the experience harder to use for people on both mobile and desktop.",
    "accessibility-structure":
      "Parts of the page structure are harder to follow than they should be, which affects usability for visitors on both mobile and desktop.",
    stability:
      "The page shifts or settles too late while loading, so visitors on both mobile and desktop may struggle to use content confidently.",
    trust:
      "Technical trust signals are being flagged in the background, which can make the experience feel less reliable on both mobile and desktop.",
    other:
      "A technical issue is creating friction across the website, and that makes browsing harder for visitors on both mobile and desktop."
  };

  return templates[insight.category];
}

function fallbackIssueWhyText(insight: ReportInsight) {
  const templates: Record<InsightCategory, string> = {
    "speed-assets":
      "Heavy pages increase abandonment before visitors see key offers, and that lowers conversions while making every click from ads or search work less efficiently.",
    "speed-delivery":
      "Inefficient delivery slows repeat visits and wastes server capacity, which makes the site feel less reliable and weakens conversion performance over time.",
    "seo-snippets":
      "Weak search snippets reduce click-through rate from search results, which limits new visitor acquisition and lowers the return from your content investment.",
    "seo-discovery":
      "Search engines receive weaker discovery signals, which can reduce rankings, limit organic traffic, and make new customer acquisition harder.",
    "accessibility-content":
      "Accessibility barriers block some visitors from using key content, increase legal exposure, and also weaken quality signals that search engines consider.",
    "accessibility-structure":
      "Structural accessibility problems make forms and navigation harder to use, which lowers completion rates and creates avoidable friction for visitors with disabilities.",
    stability:
      "Layout shifts increase accidental clicks and form mistakes, which frustrates visitors and makes the website feel less trustworthy during key actions.",
    trust:
      "Missing trust and security signals can trigger browser caution, reduce confidence in the site, and lower the chance that visitors return or convert.",
    other:
      "This issue creates measurable friction in the journey, which reduces user confidence, weakens engagement, and makes conversion paths less dependable."
  };

  return templates[insight.category];
}

function fallbackIssueActionText(insight: ReportInsight) {
  const templates: Record<InsightCategory, string> = {
    "speed-assets":
      "Ask your developer to compress large images, delay non-essential code, and retest the page. This usually improves speed very quickly.",
    "speed-delivery":
      "Ask your developer or host to improve caching, compression, and server response settings. This usually improves load speed across important pages.",
    "seo-snippets":
      "Rewrite key page titles and meta descriptions so they match visitor intent and encourage more clicks from search results.",
    "seo-discovery":
      "Ask your developer to review canonicals, indexing rules, and crawl signals so search engines can understand important pages better.",
    "accessibility-content":
      "Add clear labels, descriptive alt text, and stronger button names so every visitor can understand and use important actions.",
    "accessibility-structure":
      "Improve headings, contrast, and navigation cues so visitors can follow pages more easily and complete important tasks.",
    stability:
      "Reserve space for images and embeds, and delay layout-shifting elements so the page feels steady while loading.",
    trust:
      "Remove outdated scripts, browser warnings, and reliability issues so the website feels safer and more trustworthy to visitors.",
    other:
      "Review the flagged pages with your developer and fix the highest-impact issue first, then retest the website."
  };

  return templates[insight.category];
}

function mergeOverviewWithFallback(value: OverviewNarrative, fallback: OverviewNarrative): OverviewNarrative {
  const sanitized = sanitizeOverview(value);

  return {
    ...sanitized,
    executive_sentences: sanitized.executive_sentences.map((sentence, index) =>
      enforceSentenceRange(sentence, fallback.executive_sentences[index] ?? fallback.executive_sentences[0], 12, 24, {
        sentenceCount: 2,
        requireProfessional: true
      })
    ),
    score_summaries: {
      performance: {
        label: sanitized.score_summaries.performance.label,
        summary: enforceSentenceRange(
          sanitized.score_summaries.performance.summary,
          fallback.score_summaries.performance.summary,
          15,
          25,
          { requireBusinessImpact: true, requireProfessional: true }
        )
      },
      seo: {
        label: sanitized.score_summaries.seo.label,
        summary: enforceSentenceRange(
          sanitized.score_summaries.seo.summary,
          fallback.score_summaries.seo.summary,
          15,
          25,
          { requireBusinessImpact: true, requireProfessional: true }
        )
      },
      accessibility: {
        label: sanitized.score_summaries.accessibility.label,
        summary: enforceSentenceRange(
          sanitized.score_summaries.accessibility.summary,
          fallback.score_summaries.accessibility.summary,
          15,
          25,
          { requireBusinessImpact: true, requireProfessional: true }
        )
      },
      best_practices: {
        label: sanitized.score_summaries.best_practices.label,
        summary: enforceSentenceRange(
          sanitized.score_summaries.best_practices.summary,
          fallback.score_summaries.best_practices.summary,
          15,
          25,
          { requireBusinessImpact: true, requireProfessional: true }
        )
      }
    },
    action_plan_intro: enforceSentenceRange(
      sanitized.action_plan_intro,
      fallback.action_plan_intro,
      10,
      22,
      { requireProfessional: true }
    ),
    action_plan: sanitized.action_plan.map((week, index) => ({
      ...week,
      expected_result: enforceSentenceRange(
        week.expected_result,
        fallback.action_plan[index]?.expected_result ?? fallback.action_plan[0].expected_result,
        8,
        18,
        { requireProfessional: true }
      )
    })),
    projected_summary: enforceSentenceRange(
      sanitized.projected_summary,
      fallback.projected_summary,
      12,
      24,
      { requireProfessional: true }
    ),
    vitals_intro: enforceSentenceRange(sanitized.vitals_intro, fallback.vitals_intro, 10, 20, {
      requireProfessional: true
    }),
    vitals_overall: enforceSentenceRange(
      sanitized.vitals_overall,
      fallback.vitals_overall,
      12,
      22,
      { requireBusinessImpact: true, requireProfessional: true }
    ),
    device_intro: enforceSentenceRange(sanitized.device_intro, fallback.device_intro, 8, 16, {
      requireProfessional: true
    }),
    mobile_summary: enforceSentenceRange(
      sanitized.mobile_summary,
      fallback.mobile_summary,
      12,
      22,
      { requireBusinessImpact: true, requireProfessional: true }
    ),
    desktop_summary: enforceSentenceRange(
      sanitized.desktop_summary,
      fallback.desktop_summary,
      12,
      22,
      { requireBusinessImpact: true, requireProfessional: true }
    ),
    device_tip: enforceSentenceRange(sanitized.device_tip, fallback.device_tip, 12, 22, {
      requireBusinessImpact: true,
      requireProfessional: true
    })
  };
}

function mergeReportIssueWithFallback(
  value: ReportSectionIssue,
  fallback: ReportSectionIssue,
  insight: ReportInsight
): ReportSectionIssue {
  const sanitized = sanitizeReportIssue(value);

  return {
    ...sanitized,
    title: sanitized.title || fallback.title,
    what_is_happening: enforceSentenceRange(
      sanitized.what_is_happening,
      fallbackIssueWhatText(insight),
      20,
      35,
      { sentenceCount: 2, requireMobileDesktop: true, requireProfessional: true }
    ),
    why_it_matters: enforceSentenceRange(
      sanitized.why_it_matters,
      fallbackIssueWhyText(insight),
      15,
      25,
      { requireBusinessImpact: true, requireProfessional: true }
    ),
    root_cause: enforceSentenceRange(
      sanitized.root_cause,
      fallback.root_cause,
      12,
      24,
      { requireProfessional: true }
    )
  };
}

function mergeReportRecommendationWithFallback(
  value: ReportSectionRecommendation,
  fallback: ReportSectionRecommendation,
  insight: ReportInsight
): ReportSectionRecommendation {
  const sanitized = sanitizeReportRecommendation(value);

  return {
    ...sanitized,
    title: sanitized.title || fallback.title,
    action: enforceSentenceRange(sanitized.action, fallbackIssueActionText(insight), 15, 25, {
      sentenceCount: 2,
      requireProfessional: true
    }),
    expected_impact: enforceSentenceRange(
      sanitized.expected_impact,
      fallback.expected_impact,
      15,
      25,
      { requireBusinessImpact: true, requireProfessional: true }
    )
  };
}

function cleanRawText(text: string, maxLength = 150) {
  const cleaned = sanitizeClientText(
    text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/https?:\/\/[^\s)]+/g, "")
      .replace(/[`*_#>~]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );

  return truncateAtBoundary(cleaned, maxLength, 2);
}

function limitTitleWords(value: string, maxWords: number, maxLength: number) {
  const words = cleanRawText(value, Math.max(maxLength, 80))
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, maxWords)
    .join(" ");

  return truncateAtBoundary(words, maxLength, 1);
}

function toDeviceScope<T extends { device?: "mobile" | "desktop" }>(
  items: T[]
): "mobile" | "desktop" | "both" | null {
  const devices = Array.from(new Set(items.map((item) => item.device).filter(Boolean)));

  if (devices.length === 0) {
    return null;
  }

  if (devices.length > 1) {
    return "both";
  }

  return devices[0] ?? null;
}

function severityRank(severity: "high" | "medium" | "low") {
  return severity === "high" ? 3 : severity === "medium" ? 2 : 1;
}

function difficultyRank(difficulty: PlainLanguageDifficulty) {
  return difficulty === "Easy" ? 1 : difficulty === "Medium" ? 2 : 3;
}

function normalizeTitleKey(value: string) {
  return cleanRawText(value.toLowerCase(), 120).replace(/[^a-z0-9]+/g, " ").trim();
}

function inferPlainCategory(title: string, description: string): PlainLanguageCategory {
  const content = `${title} ${description}`.toLowerCase();

  if (/(seo|meta|sitemap|robots|search|index|schema|heading|keyword|description)/.test(content)) {
    return "SEO";
  }

  if (/(access|aria|contrast|keyboard|alt text|alt attribute|label|semantic|screen reader)/.test(content)) {
    return "Accessibility";
  }

  if (/(security|unsafe|mixed content|https|privacy|cookie|headers|csp|best practice|vulnerab)/.test(content)) {
    return "Security";
  }

  return "Performance";
}

function fallbackIssueDifficulty(severity: "high" | "medium" | "low"): PlainLanguageDifficulty {
  return severity === "high" ? "Medium" : severity === "medium" ? "Easy" : "Easy";
}

function fallbackIssueTimeEstimate(
  severity: "high" | "medium" | "low",
  difficulty: PlainLanguageDifficulty
) {
  if (severity === "high" && difficulty === "Complex") {
    return "1-2 weeks" as const;
  }

  if (severity === "high") {
    return "1-2 days" as const;
  }

  if (difficulty === "Medium") {
    return "1-2 days" as const;
  }

  return "1-2 hours" as const;
}

function fallbackRecommendationTimeEstimate(priority: "high" | "medium" | "low") {
  return priority === "high" ? "1-2 days" : priority === "medium" ? "1-2 hours" : "30 mins";
}

function summarizeDeviceScope(scope: "mobile" | "desktop" | "both" | null) {
  if (scope === "both") {
    return "This affects both mobile and desktop.";
  }

  if (scope === "mobile") {
    return "This mainly affects phone visitors.";
  }

  if (scope === "desktop") {
    return "This mainly affects desktop visitors.";
  }

  return "";
}

function buildPlainLanguageSummary(counts: { high: number; medium: number; low: number }) {
  if (counts.high > 0) {
    return `Fix the ${counts.high} high priority issue${counts.high === 1 ? "" : "s"} first to see the biggest improvement.`;
  }

  if (counts.medium > 0) {
    return `Start with the ${counts.medium} medium priority fix${counts.medium === 1 ? "" : "es"} to improve results steadily.`;
  }

  if (counts.low > 0) {
    return `Your biggest items look healthy. The remaining low priority fixes are mostly polish.`;
  }

  return "This scan looks healthy overall, with no major issues needing urgent attention.";
}

function sanitizePlainIssue(value: PlainLanguageIssue): PlainLanguageIssue {
  return {
    id: cleanRawText(value.id, 80),
    title: limitTitleWords(value.title, 5, 50),
    whats_happening: truncateAtBoundary(cleanRawText(value.whats_happening, 120), 100, 1),
    business_impact: truncateAtBoundary(cleanRawText(value.business_impact, 120), 100, 1),
    how_to_fix: truncateAtBoundary(cleanRawText(value.how_to_fix, 120), 100, 1),
    severity: value.severity,
    difficulty: value.difficulty,
    time_estimate: value.time_estimate,
    category: value.category
  };
}

function sanitizePlainRecommendation(
  value: PlainLanguageRecommendation
): PlainLanguageRecommendation {
  return {
    title: limitTitleWords(value.title, 5, 50),
    description: truncateAtBoundary(cleanRawText(value.description, 120), 100, 1),
    difficulty: value.difficulty,
    time_estimate: value.time_estimate,
    priority: value.priority
  };
}

function dedupeWebsiteDetailIssues(issues: ScanIssue[]) {
  const grouped = new Map<
    string,
    {
      issue: ScanIssue;
      device: "mobile" | "desktop" | "both" | null;
    }
  >();

  for (const issue of issues) {
    const key = normalizeTitleKey(issue.title);
    const existing = grouped.get(key);

    if (!existing) {
      grouped.set(key, {
        issue,
        device: issue.device ?? null
      });
      continue;
    }

    const mergedDevice =
      existing.device && issue.device && existing.device !== issue.device
        ? "both"
        : existing.device ?? issue.device ?? null;

    const preferredIssue =
      severityRank(issue.severity) > severityRank(existing.issue.severity) ||
      issue.description.length > existing.issue.description.length
        ? issue
        : existing.issue;

    grouped.set(key, {
      issue: preferredIssue,
      device: mergedDevice
    });
  }

  return Array.from(grouped.values())
    .sort((left, right) => severityRank(right.issue.severity) - severityRank(left.issue.severity))
    .slice(0, 8);
}

function dedupeWebsiteDetailRecommendations(recommendations: ScanRecommendation[]) {
  const grouped = new Map<
    string,
    {
      recommendation: ScanRecommendation;
      device: "mobile" | "desktop" | "both" | null;
    }
  >();

  for (const recommendation of recommendations) {
    const key = normalizeTitleKey(recommendation.title);
    const existing = grouped.get(key);

    if (!existing) {
      grouped.set(key, {
        recommendation,
        device: recommendation.device ?? null
      });
      continue;
    }

    const mergedDevice =
      existing.device && recommendation.device && existing.device !== recommendation.device
        ? "both"
        : existing.device ?? recommendation.device ?? null;

    const preferredRecommendation =
      severityRank(recommendation.priority) > severityRank(existing.recommendation.priority) ||
      recommendation.description.length > existing.recommendation.description.length
        ? recommendation
        : existing.recommendation;

    grouped.set(key, {
      recommendation: preferredRecommendation,
      device: mergedDevice
    });
  }

  return Array.from(grouped.values())
    .sort(
      (left, right) =>
        severityRank(right.recommendation.priority) - severityRank(left.recommendation.priority)
    )
    .slice(0, 5);
}

function buildFallbackPlainIssue(input: {
  issue: ScanIssue;
  device: "mobile" | "desktop" | "both" | null;
}): PlainLanguageIssue {
  const category = inferPlainCategory(input.issue.title, input.issue.description);
  const difficulty = fallbackIssueDifficulty(input.issue.severity);
  const deviceSummary = summarizeDeviceScope(input.device);

  return sanitizePlainIssue({
    id: input.issue.id,
    title: input.issue.title || "Needs attention",
    whats_happening:
      cleanRawText(input.issue.description, 100) ||
      "Parts of your website are making the experience slower or harder to use.",
    business_impact:
      truncateAtBoundary(
        cleanRawText(
          input.issue.severity === "high"
            ? "This could push visitors away before they engage with your business."
            : "This can make your website feel less trustworthy or less effective.",
          100
        ),
        100,
        1
      ) || "This can make your website feel less effective for visitors.",
    how_to_fix:
      truncateAtBoundary(
        cleanRawText(
          `Ask your developer to review and fix this area. ${deviceSummary}`.trim(),
          100
        ),
        100,
        2
      ) || "Ask your developer to review and fix this area.",
    severity: input.issue.severity,
    difficulty,
    time_estimate: fallbackIssueTimeEstimate(input.issue.severity, difficulty),
    category
  });
}

function buildFallbackPlainRecommendation(input: {
  recommendation: ScanRecommendation;
  device: "mobile" | "desktop" | "both" | null;
}): PlainLanguageRecommendation {
  const difficulty: PlainLanguageDifficulty =
    input.recommendation.priority === "high"
      ? "Medium"
      : input.recommendation.priority === "medium"
        ? "Easy"
        : "Easy";
  const deviceSummary = summarizeDeviceScope(input.device);

  return sanitizePlainRecommendation({
    title: input.recommendation.title || "Quick win",
    description:
      truncateAtBoundary(
        cleanRawText(
          `${input.recommendation.description} ${deviceSummary}`.trim(),
          100
        ),
        100,
        1
      ) || "This can improve speed, search visibility, or user experience.",
    difficulty,
    time_estimate: fallbackRecommendationTimeEstimate(input.recommendation.priority),
    priority: input.recommendation.priority
  });
}

function sanitizePlainIssues(value: PlainLanguageIssue[]) {
  const deduped = new Map<string, PlainLanguageIssue>();

  for (const issue of value.map(sanitizePlainIssue)) {
    const key = normalizeTitleKey(issue.title);
    if (!deduped.has(key)) {
      deduped.set(key, issue);
    }
  }

  return Array.from(deduped.values())
    .sort((left, right) => severityRank(right.severity) - severityRank(left.severity))
    .slice(0, 8);
}

function sanitizePlainRecommendations(value: PlainLanguageRecommendation[]) {
  const deduped = new Map<string, PlainLanguageRecommendation>();

  for (const recommendation of value.map(sanitizePlainRecommendation)) {
    const key = normalizeTitleKey(recommendation.title);
    if (!deduped.has(key)) {
      deduped.set(key, recommendation);
    }
  }

  return Array.from(deduped.values())
    .sort(
      (left, right) =>
        severityRank(right.priority) - severityRank(left.priority) ||
        difficultyRank(left.difficulty) - difficultyRank(right.difficulty)
    )
    .slice(0, 5);
}

function buildIssuePrompt(
  issues: Array<{
    issue: ScanIssue;
    device: "mobile" | "desktop" | "both" | null;
  }>
) {
  const payload = issues.map(({ issue, device }) => ({
    id: issue.id,
    title: cleanRawText(issue.title, 80),
    description: cleanRawText(issue.description, 150),
    severity: issue.severity,
    category: inferPlainCategory(issue.title, issue.description),
    device,
    affects_both: device === "both"
  }));

  return `Transform these website issues into plain English for a business owner.

Issues to transform:
${JSON.stringify(payload)}

Return a JSON array with this exact structure for each issue:
[
  {
    "id": "original issue id",
    "title": "Short plain English title (max 5 words)",
    "whats_happening": "One sentence explaining the problem simply (max 100 chars)",
    "business_impact": "One sentence on how this hurts the business (max 100 chars)",
    "how_to_fix": "One simple action sentence (max 100 chars)",
    "severity": "high/medium/low",
    "difficulty": "Easy/Medium/Complex",
    "time_estimate": "30 mins/1-2 hours/1-2 days/1-2 weeks",
    "category": "Performance/SEO/Accessibility/Security"
  }
]

Rules:
- No URLs in any field
- No technical jargon
- Max 100 characters per field
- Business owner should understand immediately
- Be encouraging not scary
- If device is "both", make it clear the issue affects both mobile and desktop versions`;
}

function buildRecommendationPrompt(
  recommendations: Array<{
    recommendation: ScanRecommendation;
    device: "mobile" | "desktop" | "both" | null;
  }>
) {
  const payload = recommendations.map(({ recommendation, device }) => ({
    title: cleanRawText(recommendation.title, 80),
    description: cleanRawText(recommendation.description, 150),
    priority: recommendation.priority,
    device,
    affects_both: device === "both"
  }));

  return `Transform these technical recommendations into simple action items for a business owner.

Recommendations:
${JSON.stringify(payload)}

Return JSON array:
[
  {
    "title": "Action title (max 5 words)",
    "description": "Why this helps (max 100 chars)",
    "difficulty": "Easy/Medium/Complex",
    "time_estimate": "30 mins/1-2 hours/1-2 days/1-2 weeks",
    "priority": "high/medium/low"
  }
]

Rules:
- No URLs in any field
- No technical jargon
- Max 100 characters per field
- Business owner should understand immediately
- Be encouraging not scary`;
}

function toRawIssueEntry(input: {
  issue: ScanIssue;
  device: "mobile" | "desktop" | "both" | null;
}): PlainLanguageRawIssue {
  return {
    id: input.issue.id,
    title: cleanRawText(input.issue.title, 80),
    description: cleanRawText(input.issue.description, 150),
    severity: input.issue.severity,
    device: input.device
  };
}

function toRawRecommendationEntry(input: {
  recommendation: ScanRecommendation;
  device: "mobile" | "desktop" | "both" | null;
}): PlainLanguageRawRecommendation {
  return {
    id: input.recommendation.id,
    title: cleanRawText(input.recommendation.title, 80),
    description: cleanRawText(input.recommendation.description, 150),
    priority: input.recommendation.priority,
    device: input.device
  };
}

function parseJsonContent<T>(raw: string, schema: z.ZodType<T>) {
  const cleaned = raw.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  const parsed = JSON.parse(cleaned) as unknown;
  return schema.parse(parsed);
}

async function getCachedSection<T>(
  cacheKey: string,
  schema: z.ZodType<T>
): Promise<{ provider: "groq" | "gemini" | "template"; payload: T } | null> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("report_ai_cache")
    .select("*")
    .eq("cache_key", cacheKey)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle<ReportAiCacheEntry>();

  if (!data) {
    return null;
  }

  try {
    return {
      provider: data.provider,
      payload: schema.parse(data.payload)
    };
  } catch {
    return null;
  }
}

async function storeCachedSection(input: {
  cacheKey: string;
  section: string;
  provider: "groq" | "gemini" | "template";
  ownerUserId: string;
  websiteId: string;
  scanId: string;
  payload: Record<string, unknown>;
}) {
  const admin = createSupabaseAdminClient();
  const expiresAt = new Date(Date.now() + CACHE_TTL_HOURS * 60 * 60 * 1000).toISOString();

  await admin.from("report_ai_cache").upsert(
    {
      owner_user_id: input.ownerUserId,
      website_id: input.websiteId,
      scan_id: input.scanId,
      cache_key: input.cacheKey,
      section: input.section,
      provider: input.provider,
      payload: input.payload,
      expires_at: expiresAt
    },
    {
      onConflict: "cache_key"
    }
  );
}

async function callGroqJson<T>(
  prompt: string,
  schema: z.ZodType<T>,
  options?: { systemPrompt?: string; responseFormat?: "json_object" | "json" }
) {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("Missing GROQ_API_KEY.");
  }

  const responseFormat = options?.responseFormat ?? "json_object";

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0.2,
      ...(responseFormat === "json_object"
        ? {
            response_format: {
              type: "json_object"
            }
          }
        : {}),
      messages: [
        {
          role: "system",
          content: options?.systemPrompt ?? SYSTEM_PROMPT
        },
        {
          role: "user",
          content: `${prompt}\n\nReturn valid JSON only.`
        }
      ]
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(45000)
  });

  if (!response.ok) {
    throw new Error(`Groq request failed (${response.status}).`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Groq returned an empty response.");
  }

  return parseJsonContent(content, schema);
}

async function callGeminiJson<T>(
  prompt: string,
  schema: z.ZodType<T>,
  options?: { systemPrompt?: string; responseFormat?: "json_object" | "json" }
) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("Missing GEMINI_API_KEY.");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `${options?.systemPrompt ?? SYSTEM_PROMPT}\n\n${prompt}\n\nReturn valid JSON only.`
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json"
        }
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(45000)
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini request failed (${response.status}).`);
  }

  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  const content = payload.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) {
    throw new Error("Gemini returned an empty response.");
  }

  return parseJsonContent(content, schema);
}

async function resolveStructuredSection<T>(input: {
  cacheKey: string;
  section: string;
  ownerUserId: string;
  websiteId: string;
  scanId: string;
  prompt: string;
  schema: z.ZodType<T>;
  fallback: () => T;
  sanitize: (value: T) => T;
  systemPrompt?: string;
  responseFormat?: "json_object" | "json";
}): Promise<{ provider: "groq" | "gemini" | "template"; payload: T }> {
  const cached = await getCachedSection(input.cacheKey, input.schema);
  if (cached) {
    return cached;
  }

  const providers: Array<{
    name: "groq" | "gemini";
    fn: (
      prompt: string,
      schema: z.ZodType<T>,
      options?: { systemPrompt?: string; responseFormat?: "json_object" | "json" }
    ) => Promise<T>;
  }> = [
    { name: "groq", fn: callGroqJson },
    { name: "gemini", fn: callGeminiJson }
  ];

  for (const provider of providers) {
    try {
      const payload = input.sanitize(
        await provider.fn(input.prompt, input.schema, {
          systemPrompt: input.systemPrompt,
          responseFormat: input.responseFormat
        })
      );
      await storeCachedSection({
        cacheKey: input.cacheKey,
        section: input.section,
        provider: provider.name,
        ownerUserId: input.ownerUserId,
        websiteId: input.websiteId,
        scanId: input.scanId,
        payload: payload as Record<string, unknown>
      });

      return {
        provider: provider.name,
        payload
      };
    } catch {
      // Fall through to the next provider.
    }
  }

  const fallbackPayload = input.sanitize(input.fallback());
  await storeCachedSection({
    cacheKey: input.cacheKey,
    section: input.section,
    provider: "template",
    ownerUserId: input.ownerUserId,
    websiteId: input.websiteId,
    scanId: input.scanId,
    payload: fallbackPayload as Record<string, unknown>
  });

  return {
    provider: "template",
    payload: fallbackPayload
  };
}

function toOverallScore(scan: ScanResult) {
  return Math.round(
    (scan.performance_score + scan.seo_score + scan.accessibility_score + scan.best_practices_score) / 4
  );
}

function getOverallHealth(scan: ScanResult) {
  const overall = toOverallScore(scan);

  if (overall >= 90 && scan.performance_score >= 85) {
    return "EXCELLENT" as const;
  }

  if (overall >= 85 && scan.performance_score >= 75) {
    return "GOOD" as const;
  }

  if (overall >= 60) {
    return "NEEDS ATTENTION" as const;
  }

  return "CRITICAL" as const;
}

function getScoreLabel(score: number) {
  if (score >= 98) {
    return "Perfect";
  }

  if (score >= 90) {
    return "Excellent";
  }

  if (score >= 80) {
    return "Good, room to improve";
  }

  if (score >= 65) {
    return "Needs attention";
  }

  return "Urgent fix needed";
}

function getScoreSummary(metric: string, score: number) {
  const messages: Record<string, { strong: string; medium: string; weak: string }> = {
    performance: {
      strong:
        "Your website loads quickly, which keeps visitors engaged longer and gives them a better chance of becoming paying customers.",
      medium:
        "Your website is usable, but faster loading would keep more visitors engaged and improve your chances of winning enquiries or sales.",
      weak:
        "Your website feels slow to visitors, which can reduce trust, increase drop-offs, and directly hurt leads, sales, and enquiries."
    },
    seo: {
      strong:
        "Search engines can understand your website clearly, which gives your business a stronger chance of attracting new visitors and customers.",
      medium:
        "Your website is visible to Google, but a few SEO fixes could improve rankings and bring in more qualified enquiries.",
      weak:
        "Your website has search gaps that may limit visibility, making it harder for potential customers to discover your business online."
    },
    accessibility: {
      strong:
        "Your website is easy for more people to use, which improves trust, reduces risk, and supports more conversions from every visitor.",
      medium:
        "Your website is in decent shape, but accessibility fixes would make the experience smoother, safer, and more inclusive for visitors.",
      weak:
        "Your website has accessibility issues that may frustrate visitors, reduce trust, and expose the business to avoidable legal risk."
    },
    best_practices: {
      strong:
        "Your website follows strong technical standards, which supports reliability, trust, and a smoother experience for visitors and customers.",
      medium:
        "Your website is generally healthy, though a few cleanup items would strengthen reliability and help visitors trust the experience more.",
      weak:
        "Your website needs technical cleanup, and these issues can make the experience feel less reliable for visitors and potential customers."
    }
  };

  const tone = score >= 90 ? "strong" : score >= 75 ? "medium" : "weak";
  return messages[metric]?.[tone] ?? "Your website has a few opportunities to improve.";
}

function toHoursLabel(minutes: number) {
  if (minutes < 60) {
    return `${minutes} mins`;
  }

  if (minutes < 120) {
    return "1-2 hours";
  }

  if (minutes < 240) {
    return "Half day";
  }

  return "1 day";
}

function normalizeForGrouping(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeIssueTitle(title: string) {
  const lower = title.toLowerCase();

  if (lower.includes("render blocking")) {
    return "Your website is loading slowly";
  }

  if (lower.includes("unused javascript")) {
    return "Your website is carrying extra code";
  }

  if (lower.includes("meta description")) {
    return "Your search snippets need attention";
  }

  if (lower.includes("image") && lower.includes("alt")) {
    return "Some visitors cannot understand your images";
  }

  if (lower.includes("cache")) {
    return "Returning visitors are not getting the fastest experience";
  }

  return sanitizeClientText(title.replace(/[-_]/g, " "));
}

const insightCategoryConfig: Record<
  InsightCategory,
  {
    title: string;
    rootCause: string;
    difficulty: ReportSectionRecommendation["effort"];
    timeToFix: string;
    fixHint: string;
  }
> = {
  "speed-assets": {
    title: "Page load speed is being held back by heavy page assets",
    rootCause: "Large images, extra scripts, and blocking files are competing with your main content on first load.",
    difficulty: "Medium",
    timeToFix: "1-3 hours",
    fixHint: "Ask your developer to compress oversized images, defer non-essential scripts, and remove code that is not needed before the page becomes visible."
  },
  "speed-delivery": {
    title: "Your delivery setup is leaving performance on the table",
    rootCause: "Caching, compression, or server response time is not as efficient as it could be.",
    difficulty: "Medium",
    timeToFix: "1-3 hours",
    fixHint: "Review browser caching, compression, and server response settings with your developer or hosting provider."
  },
  "seo-snippets": {
    title: "Search result snippets need cleanup",
    rootCause: "Key pages are missing clear titles or descriptions that help searchers choose your website.",
    difficulty: "Easy",
    timeToFix: "15-45 mins",
    fixHint: "Write clearer page titles and meta descriptions for your main pages, starting with the homepage."
  },
  "seo-discovery": {
    title: "Search engines may not fully understand key pages yet",
    rootCause: "There are crawl, indexing, or page-structure signals that make your website harder to understand.",
    difficulty: "Medium",
    timeToFix: "1-2 hours",
    fixHint: "Ask your developer to review robots rules, crawlability, canonicals, and other indexing signals."
  },
  "accessibility-content": {
    title: "Some visitors may struggle to understand important buttons, links, or images",
    rootCause: "A few elements are missing clear labels or descriptions for assistive technology.",
    difficulty: "Easy",
    timeToFix: "30-90 mins",
    fixHint: "Add clear labels, alt text, and accessible names so every visitor can understand what each element does."
  },
  "accessibility-structure": {
    title: "Parts of the page are harder to use than they should be",
    rootCause: "Some structure, contrast, or navigation cues are not as clear as they need to be.",
    difficulty: "Medium",
    timeToFix: "1-3 hours",
    fixHint: "Review headings, contrast, focus states, and page structure so the experience is easier to follow."
  },
  stability: {
    title: "The page can feel jumpy while it loads",
    rootCause: "Layout elements are shifting or responding later than visitors expect.",
    difficulty: "Medium",
    timeToFix: "1-2 hours",
    fixHint: "Reserve space for images and embeds, and reduce layout-shifting scripts during loading."
  },
  trust: {
    title: "A few technical trust signals need cleanup",
    rootCause: "Behind-the-scenes best-practice checks are flagging issues that can affect reliability or confidence.",
    difficulty: "Medium",
    timeToFix: "1-2 hours",
    fixHint: "Clean up console errors, outdated scripts, and browser best-practice warnings."
  },
  other: {
    title: "Your website has a few technical cleanups worth addressing",
    rootCause: "Some technical details are creating friction even if visitors do not see the exact cause immediately.",
    difficulty: "Medium",
    timeToFix: "1-2 hours",
    fixHint: "Review the flagged pages with your developer and resolve the highest-impact items first."
  }
};

function getInsightCategory(input: Pick<ScanIssue, "title" | "description" | "metric">): InsightCategory {
  const haystack = normalizeForGrouping(`${input.title} ${input.description} ${input.metric ?? ""}`);

  if (
    /(render blocking|unused javascript|unused css|third party|main thread|legacy javascript|reduce javascript|critical request|network dependency|minify|properly size images|image|next gen|offscreen|lazy load|encode images|responsive images|modern image formats)/.test(
      haystack
    )
  ) {
    return "speed-assets";
  }

  if (/(cache|server response|response time|compression|text compression|cdn|delivery)/.test(haystack)) {
    return "speed-delivery";
  }

  if (/(meta description|title element|document title|duplicate meta|snippet)/.test(haystack)) {
    return "seo-snippets";
  }

  if (/(robots|crawl|canonical|index|structured data|sitemap|hreflang)/.test(haystack)) {
    return "seo-discovery";
  }

  if (/(alt text|accessible name|label|aria|button name|link name|form label)/.test(haystack)) {
    return "accessibility-content";
  }

  if (/(contrast|heading|landmark|language|focus|keyboard|semantic|tab order)/.test(haystack)) {
    return "accessibility-structure";
  }

  if (/(layout shift|cumulative layout shift|responsive|jump|stability|aspect ratio|visual stability)/.test(haystack)) {
    return "stability";
  }

  if (/(console|deprecated|best practice|https|security|unsafe|browser error)/.test(haystack)) {
    return "trust";
  }

  return "other";
}

function getFallbackFingerprint(issue: ScanIssue) {
  return normalizeForGrouping(issue.title).split(" ").slice(0, 5).join("-");
}

function getInsightGroupKey(issue: ScanIssue) {
  const category = getInsightCategory(issue);
  return category === "other" ? `${category}:${getFallbackFingerprint(issue)}` : category;
}

function dedupeIssues(issues: ScanIssue[]) {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = [
      getInsightGroupKey(issue),
      normalizeForGrouping(issue.title),
      normalizeForGrouping(issue.description),
      issue.device ?? "all"
    ].join("|");

    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function dedupeRecommendations(recommendations: ScanRecommendation[]) {
  const seen = new Set<string>();
  return recommendations.filter((recommendation) => {
    const key = [
      getRecommendationCategory(recommendation),
      normalizeForGrouping(recommendation.title),
      normalizeForGrouping(recommendation.description).split(" ").slice(0, 8).join(" "),
      recommendation.device ?? "all"
    ].join("|");

    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function getRecommendationCategory(recommendation: ScanRecommendation) {
  return getInsightCategory({
    title: recommendation.title,
    description: recommendation.description,
    metric: recommendation.link ?? null
  });
}

function getHighestSeverity(issues: ScanIssue[]) {
  if (issues.some((issue) => issue.severity === "high")) {
    return "high" as const;
  }

  if (issues.some((issue) => issue.severity === "medium")) {
    return "medium" as const;
  }

  return "low" as const;
}

function getInsightScoreImpact(issues: ScanIssue[], recommendations: ScanRecommendation[]) {
  const issueImpact = Math.max(...issues.map((issue) => Math.abs(issue.scoreImpact ?? 0)), 0);
  const recommendationImpact = Math.max(
    ...recommendations.map((item) => {
      const savings = item.potentialSavingsMs ?? 0;
      if (savings >= 2000) {
        return 12;
      }

      if (savings >= 1000) {
        return 9;
      }

      if (savings >= 500) {
        return 6;
      }

      return savings > 0 ? 4 : 0;
    }),
    0
  );

  return Math.max(3, Math.min(18, Math.max(issueImpact, recommendationImpact)));
}

function getInsightDevice(issues: ScanIssue[]) {
  const devices = Array.from(new Set(issues.map((issue) => issue.device).filter(Boolean)));

  if (!devices.length) {
    return null;
  }

  if (devices.length > 1) {
    return "both" as const;
  }

  return devices[0] as "mobile" | "desktop";
}

function isCoreVitalsFailing(scan: ScanResult) {
  const lcpFailing = typeof scan.lcp === "number" && scan.lcp > 2500;
  const fidFailing = typeof scan.fid === "number" && scan.fid > 100;
  const clsFailing = typeof scan.cls === "number" && scan.cls > 0.1;

  return lcpFailing || fidFailing || clsFailing;
}

function getInsightPriority(input: {
  category: InsightCategory;
  severity: ScanIssue["severity"];
  scoreImpact: number;
  difficulty: ReportSectionRecommendation["effort"];
  issueCount: number;
  scan: ScanResult;
}) {
  const severityScore = input.severity === "high" ? 4 : input.severity === "medium" ? 2 : 1;
  const impactScore = input.scoreImpact >= 14 ? 4 : input.scoreImpact >= 9 ? 3 : input.scoreImpact >= 5 ? 2 : 1;
  const easeScore = input.difficulty === "Easy" ? 2 : input.difficulty === "Medium" ? 1 : 0;
  const countScore = input.issueCount >= 4 ? 2 : input.issueCount >= 2 ? 1 : 0;
  const total = severityScore + impactScore + easeScore + countScore;
  const coreVitalsFailing = isCoreVitalsFailing(input.scan);
  const isPerformanceInsight =
    input.category === "speed-assets" || input.category === "speed-delivery" || input.category === "stability";
  const isAccessibilityInsight =
    input.category === "accessibility-content" || input.category === "accessibility-structure";

  if (
    (input.category === "speed-assets" &&
      (coreVitalsFailing || input.scan.performance_score < 70 || input.scoreImpact >= 10)) ||
    (input.category === "stability" &&
      typeof input.scan.cls === "number" &&
      input.scan.cls > 0.1 &&
      input.scoreImpact >= 8)
  ) {
    return "Critical" as const;
  }

  if (isPerformanceInsight) {
    return input.scoreImpact >= 6 || input.severity !== "low" ? "High" as const : "Medium" as const;
  }

  if (isAccessibilityInsight) {
    return input.severity === "high" || input.scoreImpact >= 6 ? "High" as const : "Medium" as const;
  }

  if (input.category === "seo-snippets" || input.category === "seo-discovery" || input.category === "trust") {
    if (input.severity === "high" || input.scoreImpact >= 9) {
      return "High" as const;
    }

    return "Medium" as const;
  }

  if (total >= 8) {
    return "High" as const;
  }

  if (total >= 5) {
    return "Medium" as const;
  }

  return "Low" as const;
}

function buildTechnicalSummary(issues: ScanIssue[]) {
  return issues
    .map((issue) => sanitizeClientText(issue.description || issue.title))
    .filter(Boolean)
    .filter((value, index, array) => array.indexOf(value) === index)
    .slice(0, 3)
    .join(" ");
}

function buildReportInsights(scan: ScanResult) {
  const dedupedIssues = dedupeIssues(scan.issues);
  const dedupedRecommendations = dedupeRecommendations(scan.recommendations);
  const grouped = new Map<
    string,
    {
      issues: ScanIssue[];
      recommendations: ScanRecommendation[];
    }
  >();

  for (const issue of dedupedIssues) {
    const key = getInsightGroupKey(issue);
    const group = grouped.get(key) ?? { issues: [], recommendations: [] };
    group.issues.push(issue);
    grouped.set(key, group);
  }

  for (const recommendation of dedupedRecommendations) {
    const category = getRecommendationCategory(recommendation);
    const matchingKey = Array.from(grouped.keys()).find((key) => key.startsWith(category));
    const key = matchingKey ?? category;
    const group = grouped.get(key) ?? { issues: [], recommendations: [] };
    group.recommendations.push(recommendation);
    grouped.set(key, group);
  }

  return Array.from(grouped.entries())
    .map(([key, value]) => {
      if (!value.issues.length && !value.recommendations.length) {
        return null;
      }

      const representativeIssue = value.issues[0];
      const category = representativeIssue
        ? getInsightCategory(representativeIssue)
        : getRecommendationCategory(value.recommendations[0]);
      const config = insightCategoryConfig[category];
      const severity = value.issues.length
        ? getHighestSeverity(value.issues)
        : value.recommendations.some((item) => item.priority === "high")
          ? "high"
          : value.recommendations.some((item) => item.priority === "medium")
            ? "medium"
            : "low";
      const scoreImpact = getInsightScoreImpact(value.issues, value.recommendations);
      const priority = getInsightPriority({
        category,
        severity,
        scoreImpact,
        difficulty: config.difficulty,
        issueCount: value.issues.length,
        scan
      });

      return {
        id: key,
        category,
        title: category === "other" && representativeIssue ? normalizeIssueTitle(representativeIssue.title) : config.title,
        technicalSummary:
          buildTechnicalSummary(value.issues) || sanitizeClientText(value.recommendations[0]?.description ?? config.rootCause),
        rootCause: config.rootCause,
        severity,
        priority,
        scoreImpact,
        difficulty: config.difficulty,
        timeToFix: config.timeToFix,
        device: value.issues.length ? getInsightDevice(value.issues) : null,
        relatedIssues: value.issues,
        relatedRecommendations: value.recommendations
      } satisfies ReportInsight;
    })
    .filter((insight): insight is ReportInsight => Boolean(insight))
    .sort((a, b) => {
      const priorityOrder: Record<ReportPriority, number> = {
        Critical: 0,
        High: 1,
        Medium: 2,
        Low: 3
      };

      return priorityOrder[a.priority] - priorityOrder[b.priority] || b.scoreImpact - a.scoreImpact;
    });
}

function getInsightFallbackRecommendationTitle(insight: ReportInsight) {
  if (insight.relatedRecommendations[0]?.title) {
    return sanitizeClientText(insight.relatedRecommendations[0].title);
  }

  const titles: Record<InsightCategory, string> = {
    "speed-assets": "Reduce heavy assets on first load",
    "speed-delivery": "Improve caching and delivery settings",
    "seo-snippets": "Rewrite key search snippets",
    "seo-discovery": "Fix crawl and indexing signals",
    "accessibility-content": "Add clearer labels and image descriptions",
    "accessibility-structure": "Improve page structure and contrast",
    stability: "Stabilize layout during load",
    trust: "Clean up technical trust issues",
    other: "Resolve the highest-impact technical cleanup"
  };

  return titles[insight.category];
}

function getInsightFallbackImpact(insight: ReportInsight) {
  const impacts: Record<InsightCategory, string> = {
    "speed-assets":
      "This should improve load speed, keep more visitors engaged, and increase the chances of enquiries, sales, and repeat visits.",
    "speed-delivery":
      "This should improve speed and reliability, which helps visitors trust the website and stay engaged for longer.",
    "seo-snippets":
      "This should improve search visibility and increase the number of potential customers who choose your website from search results.",
    "seo-discovery":
      "This should help search engines surface the right pages more often, bringing stronger traffic and more qualified visitors.",
    "accessibility-content":
      "This should make key actions clearer for more visitors, reducing friction and improving trust, usability, and conversion opportunities.",
    "accessibility-structure":
      "This should make the experience easier to follow, helping visitors trust the website and complete more valuable actions.",
    stability:
      "This should make the page feel steadier, which reduces frustration and helps visitors stay focused on your products or services.",
    trust:
      "This should strengthen reliability and trust, making the website feel safer and more credible to potential customers.",
    other:
      "This should reduce friction across the website and make the overall experience feel more trustworthy for visitors and customers."
  };

  return impacts[insight.category];
}

function fallbackReportIssue(insight: ReportInsight): ReportSectionIssue {
  return {
    insight_id: insight.id,
    title: insight.title,
    priority: insight.priority,
    what_is_happening: fallbackIssueWhatText(insight),
    why_it_matters: fallbackIssueWhyText(insight),
    root_cause: insight.rootCause
  };
}

function fallbackReportRecommendation(insight: ReportInsight): ReportSectionRecommendation {
  return {
    insight_id: insight.id,
    title: getInsightFallbackRecommendationTitle(insight),
    action: fallbackIssueActionText(insight),
    expected_impact: getInsightFallbackImpact(insight),
    effort: insight.difficulty,
    priority: insight.priority
  };
}

function buildFallbackActionPlan(scan: ScanResult, previousScan: ScanResult | null, insights: ReportInsight[]) {
  const quickWins = insights.filter((insight) => insight.difficulty === "Easy").slice(0, 3);
  const performanceWork = insights
    .filter((insight) => ["speed-assets", "speed-delivery", "stability"].includes(insight.category))
    .slice(0, 3);
  const polishWork = insights
    .filter((insight) => !quickWins.includes(insight) && !performanceWork.includes(insight))
    .slice(0, 3);
  const projectedLift = Math.min(
    12,
    insights.slice(0, 4).reduce((sum, insight) => sum + Math.min(4, Math.round(insight.scoreImpact / 3)), 0)
  );
  const projectedLow = Math.min(100, toOverallScore(scan) + Math.max(4, projectedLift - 2));
  const projectedHigh = Math.min(100, toOverallScore(scan) + Math.max(6, projectedLift + 2));
  const performanceDelta = previousScan ? scan.performance_score - previousScan.performance_score : 0;
  const seoDelta = previousScan ? scan.seo_score - previousScan.seo_score : 0;

  return {
    overall_health: getOverallHealth(scan),
    executive_sentences: [
      insights[0]?.priority === "Critical"
        ? "Your website has a few high-impact issues that are worth fixing quickly because they can affect enquiries and trust."
        : "Your website has a solid foundation overall, and the remaining work is now clearer and easier to prioritize.",
      scan.accessibility_score >= 85
        ? "Accessibility is one of your stronger areas, which helps protect the experience for more visitors."
        : "Accessibility is worth improving next, because it affects usability, trust, and legal risk."
    ],
    score_summaries: {
      performance: {
        label: getScoreLabel(scan.performance_score),
        summary: getScoreSummary("performance", scan.performance_score)
      },
      seo: {
        label: getScoreLabel(scan.seo_score),
        summary: getScoreSummary("seo", scan.seo_score)
      },
      accessibility: {
        label: getScoreLabel(scan.accessibility_score),
        summary: getScoreSummary("accessibility", scan.accessibility_score)
      },
      best_practices: {
        label: getScoreLabel(scan.best_practices_score),
        summary: getScoreSummary("best_practices", scan.best_practices_score)
      }
    },
    changes_summary:
      previousScan
        ? `Performance moved ${performanceDelta >= 0 ? "up" : "down"} by ${Math.abs(performanceDelta)} points, while SEO moved ${seoDelta >= 0 ? "up" : "down"} by ${Math.abs(seoDelta)} points. The main opportunity now is to focus on the few fixes that remove the biggest friction first.`
        : "Your first scan gives you a clear shortlist of practical improvements, so the next steps can stay focused instead of overwhelming.",
    action_plan_title: "Your 30-Day Improvement Plan",
    action_plan_intro:
      "Start with the smaller fixes that are quick to complete, then move into the improvements that most directly affect speed, visibility, and trust.",
    action_plan: [
      {
        phase: "Week 1",
        focus: "Quick wins",
        expected_result: "Expected result: remove the easiest blockers first and create momentum.",
        tasks:
          quickWins.length > 0
            ? quickWins.map((insight) => ({
                task: insight.relatedRecommendations[0]?.title ?? insight.title,
                time: insight.timeToFix
              }))
            : [
                { task: "Clean up page titles and meta descriptions", time: "30 mins" },
                { task: "Fix missing labels and image descriptions", time: "1 hour" }
              ]
      },
      {
        phase: "Week 2",
        focus: "Performance",
        expected_result: "Expected result: make your website feel faster for both new and returning visitors.",
        tasks:
          performanceWork.length > 0
            ? performanceWork.map((insight) => ({
                task: insight.relatedRecommendations[0]?.title ?? insight.title,
                time: insight.timeToFix
              }))
            : [
                { task: "Reduce unused scripts and delay non-essential files", time: "1-2 hours" },
                { task: "Improve image delivery and caching", time: "1-2 hours" }
              ]
      },
      {
        phase: "Week 3-4",
        focus: "Polish",
        expected_result: "Expected result: tighten up the remaining issues so your website stays dependable month after month.",
        tasks:
          polishWork.length > 0
            ? polishWork.map((insight) => ({
                task: insight.relatedRecommendations[0]?.title ?? insight.title,
                time: insight.timeToFix
              }))
            : [
                { task: "Retest the site after fixes and review remaining low-priority items", time: "30 mins" },
                { task: "Clean up any smaller trust or UX warnings", time: "1 hour" }
              ]
      }
    ],
    projected_score_range: `${projectedLow}-${projectedHigh}`,
    projected_summary: `If you complete the plan above, your overall score could move from ${toOverallScore(scan)} to roughly ${projectedLow}-${projectedHigh} over the next 30 days.`,
    vitals_intro:
      "Google mainly looks at how quickly your website appears, how quickly it reacts, and whether the layout stays stable while loading.",
    vitals: [
      {
        title: "Page Load Speed",
        value_label: `${((scan.lcp ?? 0) / 1000).toFixed(2)} seconds`,
        status_label: (scan.lcp ?? 0) <= 2500 ? "Passing" : (scan.lcp ?? 0) <= 4000 ? "Watch closely" : "Needs work",
        explanation:
          (scan.lcp ?? 0) <= 2500
            ? "Your main content appears quickly, which is a strong sign for both visitors and Google."
            : "Your main content is taking longer than ideal to appear, so some visitors may leave before they engage."
      },
      {
        title: "Click Response",
        value_label: `${Math.round(scan.fid ?? 0)} ms`,
        status_label: (scan.fid ?? 0) <= 100 ? "Excellent" : (scan.fid ?? 0) <= 300 ? "Okay" : "Needs work",
        explanation:
          (scan.fid ?? 0) <= 100
            ? "Your website reacts quickly when visitors click, which makes it feel responsive and trustworthy."
            : "Your website can feel a little sluggish after clicks, which may make important actions feel less smooth."
      },
      {
        title: "Visual Stability",
        value_label: `${(scan.cls ?? 0).toFixed(4)}`,
        status_label: (scan.cls ?? 0) <= 0.1 ? "Excellent" : (scan.cls ?? 0) <= 0.25 ? "Watch closely" : "Needs work",
        explanation:
          (scan.cls ?? 0) <= 0.1
            ? "Your pages stay steady while loading, so visitors are less likely to misclick."
            : "Some layout movement is still happening while the page loads, which can feel awkward or untrustworthy."
      }
    ],
    vitals_overall:
      (scan.lcp ?? 0) <= 2500 && (scan.fid ?? 0) <= 100 && (scan.cls ?? 0) <= 0.1
        ? "Your website is passing Google's most important experience checks, which supports stronger search visibility."
        : "Your website has a few experience signals worth improving so visitors get a smoother first impression.",
    device_intro:
      "Checking phones and computers separately matters because many visitors first meet your website on a mobile device.",
    mobile_summary:
      (scan.mobile_snapshot?.performance_score ?? scan.performance_score) >= 85
        ? "Mobile visitors should get a smooth experience overall, with only minor room for improvement."
        : "Mobile visitors are likely feeling the friction more than desktop visitors, so this is a smart area to improve next.",
    desktop_summary:
      (scan.desktop_snapshot?.performance_score ?? scan.performance_score) >= 90
        ? "Desktop visitors are getting a strong experience overall."
        : "Desktop performance is decent, but it still has room to improve with cleanup work.",
    device_tip:
      "A modest gap between mobile and desktop is normal. The priority is making sure phone visitors still get a fast and dependable experience."
  };
}

function buildOverviewPrompt(input: {
  website: Website;
  scan: ScanResult;
  previousScan: ScanResult | null;
  branding: AgencyBranding | null;
  profile: UserProfile;
  insights: ReportInsight[];
}) {
  const delta = {
    performance:
      input.previousScan ? input.scan.performance_score - input.previousScan.performance_score : null,
    seo: input.previousScan ? input.scan.seo_score - input.previousScan.seo_score : null,
    accessibility:
      input.previousScan ? input.scan.accessibility_score - input.previousScan.accessibility_score : null,
    bestPractices:
      input.previousScan
        ? input.scan.best_practices_score - input.previousScan.best_practices_score
        : null
  };

  return `Write a client-friendly website report overview as JSON for this website:

${JSON.stringify(
    {
      website_url: input.website.url,
      client_name: input.website.label,
      agency_name:
        input.branding?.agency_name || input.branding?.email_from_name || input.profile.full_name || "Your agency",
      scores: {
        performance: input.scan.performance_score,
        seo: input.scan.seo_score,
        accessibility: input.scan.accessibility_score,
        best_practices: input.scan.best_practices_score,
        overall: toOverallScore(input.scan)
      },
      score_changes_since_last_scan: delta,
      raw_issue_count: input.scan.issues.length,
      grouped_insight_count: input.insights.length,
      critical_or_high_insights: input.insights.filter((insight) => ["Critical", "High"].includes(insight.priority)).length,
      medium_insights: input.insights.filter((insight) => insight.priority === "Medium").length,
      key_insights: input.insights.slice(0, 6).map((insight) => ({
        title: insight.title,
        priority: insight.priority,
        root_cause: insight.rootCause,
        issue_count: insight.relatedIssues.length,
        score_impact: insight.scoreImpact,
        device: insight.device
      })),
      recommendations: dedupeRecommendations(input.scan.recommendations).slice(0, 8).map((item) => ({
        title: item.title,
        priority: item.priority,
        description: item.description,
        potential_savings_ms: item.potentialSavingsMs ?? null
      })),
      human_metrics: {
        page_load_speed_seconds: Number(((input.scan.lcp ?? 0) / 1000).toFixed(2)),
        click_response_ms: Math.round(input.scan.fid ?? 0),
        visual_stability_score: Number((input.scan.cls ?? 0).toFixed(4))
      },
      mobile_performance: input.scan.mobile_snapshot?.performance_score ?? input.scan.performance_score,
      desktop_performance: input.scan.desktop_snapshot?.performance_score ?? input.scan.performance_score
    },
    null,
    2
  )}

Return JSON with this exact shape:
{
  "overall_health": "EXCELLENT | GOOD | NEEDS ATTENTION | CRITICAL",
  "executive_sentences": ["sentence 1", "sentence 2"],
  "score_summaries": {
    "performance": { "label": "...", "summary": "..." },
    "seo": { "label": "...", "summary": "..." },
    "accessibility": { "label": "...", "summary": "..." },
    "best_practices": { "label": "...", "summary": "..." }
  },
  "changes_summary": "...",
  "action_plan_title": "Your 30-Day Improvement Plan",
  "action_plan_intro": "...",
  "action_plan": [
    {
      "phase": "Week 1",
      "focus": "Quick wins",
      "expected_result": "...",
      "tasks": [{ "task": "...", "time": "..." }]
    },
    {
      "phase": "Week 2",
      "focus": "Performance",
      "expected_result": "...",
      "tasks": [{ "task": "...", "time": "..." }]
    },
    {
      "phase": "Week 3-4",
      "focus": "Polish",
      "expected_result": "...",
      "tasks": [{ "task": "...", "time": "..." }]
    }
  ],
  "projected_score_range": "...",
  "projected_summary": "...",
  "vitals_intro": "...",
  "vitals": [
    { "title": "Page Load Speed", "value_label": "...", "status_label": "...", "explanation": "..." },
    { "title": "Click Response", "value_label": "...", "status_label": "...", "explanation": "..." },
    { "title": "Visual Stability", "value_label": "...", "status_label": "...", "explanation": "..." }
  ],
  "vitals_overall": "...",
  "device_intro": "...",
  "mobile_summary": "...",
  "desktop_summary": "...",
  "device_tip": "..."
}

Rules:
- Be strict, concise, and evidence-based.
- Do not use vague phrases like "may affect performance", "could improve experience", "worth improving", or "meaningful upside".
- If you mention speed or performance, anchor the explanation to the provided metric values and compare them against the expected target where possible.
- Every score_summaries.*.summary field must be one complete sentence between 15 and 25 words.
- Every score_summaries.*.summary field must mention business impact like visitors, customers, sales, trust, or rankings.
- Every action_plan[*].expected_result field must be a professional sentence with at least 8 words.
- action_plan_intro, vitals_intro, device_intro, and projected_summary must sound professional and consultant-ready.
- Never use casual phrases like "Fix issues!", "Check vitals!", "Check devices!", or "Great score!".
- Never return one-word responses or incomplete sentences.
- If any field is under the minimum word count, rewrite it until it meets the minimum.
- End each sentence cleanly with . ! or ?.
- Never end a field with dangling words like "and", "but", "to", "for", "the", or "your".
- Do not use technical acronyms like LCP, FID, CLS, TBT, TTFB in the JSON.`;
}

function buildSectionsPrompt(input: {
  website: Website;
  scan: ScanResult;
  insights: ReportInsight[];
}) {
  return `You are writing a structured website report for a non-technical business owner.

Turn the normalized insights below into two JSON arrays:
1. "issues" = one grouped consultant-style issue per insight
2. "recommendations" = one concrete action per insight

Rules:
- Produce exactly one issue and one recommendation for every insight_id.
- Do not repeat the same root problem in multiple titles.
- Keep language plain-English, specific, and business-focused.
- Every issue must stay evidence-based: use the supplied metrics, findings, root causes, and thresholds instead of generic advice.
- Do not use vague phrases like "may affect performance", "could improve experience", "worth improving", or "meaningful upside".
- Do not copy raw Lighthouse wording directly.
- Recommendation priority must match the issue priority.
- Recommendation should clearly map to the matching issue via insight_id.
- what_is_happening must be 20 to 35 words, explain the specific problem clearly, and mention both mobile and desktop.
- why_it_matters must be 15 to 25 words and clearly mention business impact.
- root_cause must explain the technical cause directly and stay specific.
- action must be 15 to 25 words, specific, and clearly tell a developer or owner what to do next.
- expected_impact must be 15 to 25 words and mention business impact.
- Never return one-word responses or incomplete sentences.
- If any field is under the minimum word count, rewrite it until it meets the minimum.
- End each sentence cleanly with . ! or ?.
- Never end a field with dangling words like "and", "but", "to", "for", "the", or "your".

${JSON.stringify(
    {
      website_url: input.website.url,
      scores: {
        performance: input.scan.performance_score,
        seo: input.scan.seo_score,
        accessibility: input.scan.accessibility_score,
        best_practices: input.scan.best_practices_score
      },
      core_web_vitals_status: {
        page_load_speed_seconds: Number(((input.scan.lcp ?? 0) / 1000).toFixed(2)),
        click_response_ms: Math.round(input.scan.fid ?? 0),
        visual_stability_score: Number((input.scan.cls ?? 0).toFixed(4))
      },
      grouped_insights: input.insights.map((insight) => ({
        insight_id: insight.id,
        category: insight.category,
        title_hint: insight.title,
        priority_hint: insight.priority,
        severity: insight.severity,
        score_impact: insight.scoreImpact,
        difficulty_hint: insight.difficulty,
        device: insight.device,
        grouped_issue_count: insight.relatedIssues.length,
        technical_summary: insight.technicalSummary,
        root_cause_hint: insight.rootCause,
        related_findings: insight.relatedIssues.slice(0, 5).map((issue) => ({
          title: issue.title,
          description: issue.description,
          severity: issue.severity,
          metric: issue.metric ?? null
        })),
        related_recommendations: insight.relatedRecommendations.slice(0, 4).map((recommendation) => ({
          title: recommendation.title,
          description: recommendation.description,
          priority: recommendation.priority,
          potential_savings_ms: recommendation.potentialSavingsMs ?? null
        }))
      }))
    },
    null,
    2
  )}

Return JSON with this exact shape:
{
  "issues": [
    {
      "insight_id": "...",
      "title": "...",
      "priority": "Critical | High | Medium | Low",
      "what_is_happening": "...",
      "why_it_matters": "...",
      "root_cause": "..."
    }
  ],
  "recommendations": [
    {
      "insight_id": "...",
      "title": "...",
      "action": "...",
      "expected_impact": "...",
      "effort": "Easy | Medium | Hard",
      "priority": "Critical | High | Medium | Low"
    }
  ]
}`;
}

function buildSectionsCacheKey(scanId: string, insights: ReportInsight[]) {
  const hash = createHash("sha256")
    .update(
      JSON.stringify(
        insights.map((insight) => ({
          id: insight.id,
          category: insight.category,
          priority: insight.priority,
          scoreImpact: insight.scoreImpact,
          relatedIssues: insight.relatedIssues.map((issue) => ({
            title: issue.title,
            description: issue.description,
            severity: issue.severity
          })),
          relatedRecommendations: insight.relatedRecommendations.map((item) => ({
            title: item.title,
            description: item.description,
            priority: item.priority
          }))
        }))
      )
    )
    .digest("hex")
    .slice(0, 12);

  return `report-sections:v4:${scanId}:${hash}`;
}

function mergeSectionsWithFallback(
  payload: ReportSectionsPayload,
  insights: ReportInsight[]
): ReportSectionsPayload {
  const sanitizedPayload = sanitizeReportSections(payload);
  const issueMap = new Map<string, ReportSectionIssue>();
  const recommendationMap = new Map<string, ReportSectionRecommendation>();

  for (const issue of sanitizedPayload.issues) {
    if (!issueMap.has(issue.insight_id)) {
      issueMap.set(issue.insight_id, issue);
    }
  }

  for (const recommendation of sanitizedPayload.recommendations) {
    if (!recommendationMap.has(recommendation.insight_id)) {
      recommendationMap.set(recommendation.insight_id, recommendation);
    }
  }

  const mergedIssues = insights.map((insight) => {
    const fallback = fallbackReportIssue(insight);
    const issue = issueMap.get(insight.id) ?? fallback;
    return mergeReportIssueWithFallback(
      {
        ...issue,
        insight_id: insight.id,
        priority: insight.priority
      },
      {
        ...fallback,
        insight_id: insight.id,
        priority: insight.priority
      },
      insight
    );
  });

  const seenWhyText = new Set<string>();
  const uniqueIssues = mergedIssues.map((issue, index) => {
    const normalizedWhy = sanitizeClientText(issue.why_it_matters).toLowerCase();
    if (!normalizedWhy || seenWhyText.has(normalizedWhy)) {
      const insight = insights[index];
      const uniqueFallbackSeed = `${fallbackIssueWhyText(insight).replace(/[.!?]+$/, "")} It specifically affects ${cleanRawText(
        insight.title,
        28
      ).toLowerCase()}.`;
      const fallbackWhy = enforceSentenceRange(
        uniqueFallbackSeed,
        uniqueFallbackSeed,
        15,
        25,
        { requireBusinessImpact: true, requireProfessional: true }
      );

      seenWhyText.add(sanitizeClientText(fallbackWhy).toLowerCase());

      return {
        ...issue,
        why_it_matters: fallbackWhy
      };
    }

    seenWhyText.add(normalizedWhy);
    return issue;
  });

  return {
    issues: uniqueIssues,
    recommendations: insights.map((insight) => {
      const fallback = fallbackReportRecommendation(insight);
      const recommendation = recommendationMap.get(insight.id) ?? fallback;
      return mergeReportRecommendationWithFallback(
        {
          ...recommendation,
          insight_id: insight.id,
          effort: recommendation.effort ?? insight.difficulty,
          priority: insight.priority
        },
        {
          ...fallback,
          insight_id: insight.id,
          effort: fallback.effort ?? insight.difficulty,
          priority: insight.priority
        },
        insight
      );
    })
  };
}

function groupIssuesByPriority(
  issues: Array<{ insight: ReportInsight; ai: ReportSectionIssue }>
): ReportIssueGroup[] {
  const groups: ReportIssueGroup[] = [
    {
      title: "Fix This Week",
      emoji: "🔴",
      color: "#EF4444",
      issues: issues.filter((item) => item.insight.priority === "Critical" || item.insight.priority === "High")
    },
    {
      title: "Fix This Month",
      emoji: "🟡",
      color: "#F59E0B",
      issues: issues.filter((item) => item.insight.priority === "Medium")
    },
    {
      title: "Nice To Have",
      emoji: "🟢",
      color: "#22C55E",
      issues: issues.filter((item) => item.insight.priority === "Low")
    }
  ];

  return groups.filter((group) => group.issues.length > 0);
}

function groupRecommendationsByPriority(
  recommendations: Array<{ insight: ReportInsight; ai: ReportSectionRecommendation }>
): ReportRecommendationGroup[] {
  const groups: ReportRecommendationGroup[] = [
    {
      title: "Fix This Week",
      emoji: "🔴",
      color: "#EF4444",
      recommendations: recommendations.filter(
        (item) => item.insight.priority === "Critical" || item.insight.priority === "High"
      )
    },
    {
      title: "Fix This Month",
      emoji: "🟡",
      color: "#F59E0B",
      recommendations: recommendations.filter((item) => item.insight.priority === "Medium")
    },
    {
      title: "Nice To Have",
      emoji: "🟢",
      color: "#22C55E",
      recommendations: recommendations.filter((item) => item.insight.priority === "Low")
    }
  ];

  return groups.filter((group) => group.recommendations.length > 0);
}

export async function buildWebsiteScanPlainEnglish(input: {
  scan: ScanResult;
  profile: UserProfile;
  websiteId: string;
}): Promise<WebsiteScanPlainEnglish> {
  const deduplicatedIssues = dedupeWebsiteDetailIssues(input.scan.issues ?? []);
  const deduplicatedRecommendations = dedupeWebsiteDetailRecommendations(input.scan.recommendations ?? []);
  const rawIssues = deduplicatedIssues.map(toRawIssueEntry);
  const rawRecommendations = deduplicatedRecommendations.map(toRawRecommendationEntry);

  const issuesResult =
    deduplicatedIssues.length > 0
      ? await resolveStructuredSection({
          cacheKey: `issues_${input.scan.id}`,
          section: "website_detail_issues",
          ownerUserId: input.profile.id,
          websiteId: input.websiteId,
          scanId: input.scan.id,
          prompt: buildIssuePrompt(deduplicatedIssues),
          schema: websiteDetailIssuesSchema,
          fallback: () => deduplicatedIssues.map(buildFallbackPlainIssue),
          sanitize: sanitizePlainIssues,
          systemPrompt: WEBSITE_DETAIL_SYSTEM_PROMPT,
          responseFormat: "json"
        })
      : {
          provider: "template" as const,
          payload: [] as PlainLanguageIssue[]
        };

  const issueMap = new Map(issuesResult.payload.map((issue) => [issue.id, sanitizePlainIssue(issue)]));
  const issues = deduplicatedIssues.map(({ issue, device }) => issueMap.get(issue.id) ?? buildFallbackPlainIssue({ issue, device }));

  const recommendationsResult =
    deduplicatedRecommendations.length > 0
      ? await resolveStructuredSection({
          cacheKey: `recommendations_${input.scan.id}`,
          section: "website_detail_recommendations",
          ownerUserId: input.profile.id,
          websiteId: input.websiteId,
          scanId: input.scan.id,
          prompt: buildRecommendationPrompt(deduplicatedRecommendations),
          schema: websiteDetailRecommendationsSchema,
          fallback: () => deduplicatedRecommendations.map(buildFallbackPlainRecommendation),
          sanitize: sanitizePlainRecommendations,
          systemPrompt: WEBSITE_DETAIL_SYSTEM_PROMPT,
          responseFormat: "json"
        })
      : {
          provider: "template" as const,
          payload: [] as PlainLanguageRecommendation[]
        };

  const recommendations = deduplicatedRecommendations.map(
    ({ recommendation, device }, index) =>
      recommendationsResult.payload[index] ?? buildFallbackPlainRecommendation({ recommendation, device })
  );

  const severityCounts = {
    high: issues.filter((issue) => issue.severity === "high").length,
    medium: issues.filter((issue) => issue.severity === "medium").length,
    low: issues.filter((issue) => issue.severity === "low").length
  };

  const provider =
    issuesResult.provider === "groq" || recommendationsResult.provider === "groq"
      ? "groq"
      : issuesResult.provider === "gemini" || recommendationsResult.provider === "gemini"
        ? "gemini"
        : "template";

  return {
    provider,
    summary: buildPlainLanguageSummary(severityCounts),
    severity_counts: severityCounts,
    issues,
    recommendations,
    raw_issues: rawIssues,
    raw_recommendations: rawRecommendations
  };
}

export async function buildReportNarrative(input: {
  website: Website;
  scan: ScanResult;
  previousScan: ScanResult | null;
  branding: AgencyBranding | null;
  profile: UserProfile;
}): Promise<ReportNarrative> {
  const insights = buildReportInsights(input.scan);
  const fallbackOverview = buildFallbackActionPlan(input.scan, input.previousScan, insights);
  const overviewResult = await resolveStructuredSection({
    cacheKey: `report-overview:v3:${input.scan.id}`,
    section: "overview",
    ownerUserId: input.profile.id,
    websiteId: input.website.id,
    scanId: input.scan.id,
    prompt: buildOverviewPrompt({
      ...input,
      insights
    }),
    schema: overviewSchema,
    fallback: () => fallbackOverview,
    sanitize: (payload) => mergeOverviewWithFallback(payload, fallbackOverview)
  });

  const sectionsResult = await resolveStructuredSection({
    cacheKey: buildSectionsCacheKey(input.scan.id, insights),
    section: "issues_recommendations",
    ownerUserId: input.profile.id,
    websiteId: input.website.id,
    scanId: input.scan.id,
    prompt: buildSectionsPrompt({
      website: input.website,
      scan: input.scan,
      insights
    }),
    schema: reportSectionsSchema,
    fallback: () => ({
      issues: insights.map(fallbackReportIssue),
      recommendations: insights.map(fallbackReportRecommendation)
    }),
    sanitize: (payload) => mergeSectionsWithFallback(payload, insights)
  });

  const issues = insights.map((insight) => ({
    insight,
    ai:
      sectionsResult.payload.issues.find((item) => item.insight_id === insight.id) ??
      fallbackReportIssue(insight)
  }));
  const recommendations = insights.map((insight) => ({
    insight,
    ai:
      sectionsResult.payload.recommendations.find((item) => item.insight_id === insight.id) ??
      fallbackReportRecommendation(insight)
  }));

  const groupedIssues = groupIssuesByPriority(issues);
  const groupedRecommendations = groupRecommendationsByPriority(recommendations);

  const provider =
    overviewResult.provider === "template" || sectionsResult.provider === "template"
      ? "template"
      : overviewResult.provider === "groq" || sectionsResult.provider === "groq"
        ? "groq"
        : "gemini";

  return {
    provider,
    overview: overviewResult.payload,
    issues,
    recommendations,
    groupedIssues,
    groupedRecommendations
  };
}
