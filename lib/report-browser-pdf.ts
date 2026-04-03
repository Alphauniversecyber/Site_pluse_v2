import "server-only";

import type {
  AgencyBranding,
  ScanResult,
  ScanSchedule,
  UserProfile,
  Website
} from "@/types";
import { buildReportNarrative, type ReportNarrative, type ReportPriority } from "@/lib/report-ai";
import { formatDateTime } from "@/lib/utils";

const NAVY = "#0F172A";
const SLATE_950 = "#0F172A";
const SLATE_900 = "#1E293B";
const SLATE_700 = "#475569";
const SLATE_600 = "#64748B";
const SLATE_500 = "#94A3B8";
const SLATE_300 = "#CBD5E1";
const SURFACE = "#FFFFFF";
const SURFACE_SOFT = "#F8FAFC";
const SURFACE_TINT = "#EFF6FF";
const BLUE = "#2563EB";
const BLUE_SOFT = "rgba(37,99,235,0.10)";
const GREEN = "#16A34A";
const GREEN_SOFT = "rgba(22,163,74,0.10)";
const ORANGE = "#D97706";
const ORANGE_SOFT = "rgba(217,119,6,0.12)";
const RED = "#DC2626";
const RED_SOFT = "rgba(220,38,38,0.10)";
const BORDER = "rgba(15,23,42,0.10)";
const SHADOW = "0 18px 42px rgba(15,23,42,0.06)";
const INDUSTRY_SCORE = 78;
const BANNED_TERMS = /\b(LCP|FID|CLS|TBT|TTFB|INP|DOM|API|CDN|HTTP|CSS|JS)\b/gi;

const SCORE_SUPPORT_LABELS = {
  performance: "Performance Overview",
  seo: "Search Visibility",
  accessibility: "Accessibility Status",
  bestPractices: "Standards Compliance"
} as const;

type Tone = {
  color: string;
  background: string;
  border: string;
};

type Context = {
  website: Website;
  scan: ScanResult;
  previousScan: ScanResult | null;
  history: ScanResult[];
  branding?: AgencyBranding | null;
  profile: UserProfile;
  schedule?: ScanSchedule | null;
};

type PdfPage = {
  dark?: boolean;
  content: string;
};

type PdfIssue = {
  title: string;
  priority: ReportPriority;
  what: string;
  why: string;
  rootCause: string;
  recommendation: string;
  difficulty: "Easy" | "Medium" | "Hard";
  time: string;
  scoreImpact: number;
};

type PdfRecommendation = {
  title: string;
  priority: ReportPriority;
  action: string;
  impact: string;
  effort: "Easy" | "Medium" | "Hard";
  time: string;
  scoreImpact: number;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function cleanCopy(value: string) {
  return value
    .replace(BANNED_TERMS, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/https?:\/\/[^\s)]+/g, "")
    .replace(/[`*_#>~]/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,!?;:])/g, "$1")
    .trim();
}

function splitSentences(value: string) {
  return cleanCopy(value)
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function takeSentences(value: string, count: number) {
  const sentences = splitSentences(value);
  if (sentences.length === 0) {
    return cleanCopy(value);
  }

  return sentences.slice(0, count).join(" ");
}

function takeWords(value: string, count: number) {
  return cleanCopy(value)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, count)
    .join(" ");
}

function chunk<T>(items: T[], size: number) {
  const result: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }

  return result;
}

function priorityRank(priority: ReportPriority) {
  return priority === "Critical" ? 0 : priority === "High" ? 1 : priority === "Medium" ? 2 : 3;
}

function overallScore(scan: ScanResult) {
  return Math.round(
    (scan.performance_score + scan.seo_score + scan.accessibility_score + scan.best_practices_score) / 4
  );
}

function brandName(input: Context) {
  return (
    input.branding?.agency_name ||
    input.branding?.email_from_name ||
    input.profile.full_name ||
    "Your Agency"
  );
}

function contactEmail(input: Context) {
  return input.profile.email;
}

function nextReportDate(input: Context) {
  if (input.schedule?.next_scan_at) {
    return formatDateTime(input.schedule.next_scan_at);
  }

  const anchor = new Date(input.scan.scanned_at);
  const frequency = input.profile.email_report_frequency;
  if (frequency === "daily") {
    anchor.setDate(anchor.getDate() + 1);
  } else if (frequency === "weekly") {
    anchor.setDate(anchor.getDate() + 7);
  } else {
    anchor.setMonth(anchor.getMonth() + 1);
  }

  return formatDateTime(anchor);
}

async function fetchImageAsDataUrl(url: string) {
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(15000)
  });

  if (!response.ok) {
    throw new Error("Unable to load branding logo.");
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get("content-type") ?? "image/png";
  return `data:${contentType};base64,${buffer.toString("base64")}`;
}

function healthLabel(scan: ScanResult, overview: ReportNarrative["overview"]) {
  if (overview.overall_health === "EXCELLENT") {
    return "EXCELLENT";
  }

  const score = overallScore(scan);
  if (score >= 90 && scan.performance_score >= 85) {
    return "EXCELLENT";
  }

  return overview.overall_health;
}

function tone(color: string, background: string): Tone {
  return {
    color,
    background,
    border: color
  };
}

function healthTone(label: string) {
  if (label === "EXCELLENT") return tone(GREEN, GREEN_SOFT);
  if (label === "GOOD") return tone(BLUE, BLUE_SOFT);
  if (label === "NEEDS ATTENTION") return tone(ORANGE, ORANGE_SOFT);
  return tone(RED, RED_SOFT);
}

function priorityTone(priority: ReportPriority) {
  if (priority === "Critical") return tone(RED, RED_SOFT);
  if (priority === "High") return tone(ORANGE, ORANGE_SOFT);
  if (priority === "Medium") return tone(BLUE, BLUE_SOFT);
  return tone(GREEN, GREEN_SOFT);
}

function neutralTone(): Tone {
  return {
    color: SLATE_700,
    background: "rgba(148,163,184,0.12)",
    border: "rgba(148,163,184,0.24)"
  };
}

function scoreTone(score: number) {
  if (score >= 90) {
    return { label: "Excellent", tone: tone(GREEN, GREEN_SOFT) };
  }
  if (score >= 75) {
    return { label: "Good", tone: tone(BLUE, BLUE_SOFT) };
  }
  if (score >= 50) {
    return { label: "Needs attention", tone: tone(ORANGE, ORANGE_SOFT) };
  }
  return { label: "Critical", tone: tone(RED, RED_SOFT) };
}

function withDeviceNote(value: string, device: "mobile" | "desktop" | "both" | null) {
  if (device !== "both" || /both mobile and desktop/i.test(value)) {
    return value;
  }

  return `${cleanCopy(value)} This affects both mobile and desktop visitors.`;
}

function difficultyLabel(value: "Easy" | "Medium" | "Hard") {
  return value === "Hard" ? "Complex" : value;
}

function badgeHtml(label: string, badgeTone: Tone, className = "") {
  return `<span class="pill ${className}" style="--pill-color:${badgeTone.color}; --pill-bg:${badgeTone.background}; --pill-border:${badgeTone.border};">${escapeHtml(
    label
  )}</span>`;
}

function metaChipHtml(label: string) {
  return badgeHtml(label, neutralTone(), "pill--meta");
}

function sectionHeaderHtml(input: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  return `
    <header class="section-header">
      ${input.eyebrow ? `<p class="section-header__eyebrow">${escapeHtml(input.eyebrow)}</p>` : ""}
      <h1>${escapeHtml(input.title)}</h1>
      ${input.subtitle ? `<p class="section-header__subtitle">${escapeHtml(input.subtitle)}</p>` : ""}
    </header>
  `;
}

function footerHtml(
  pageNumber: number,
  totalPages: number,
  name: string,
  email: string,
  logo: string | null,
  dark?: boolean
) {
  const logoHtml = logo
    ? `<img class="footer-logo ${dark ? "footer-logo--white" : ""}" src="${logo}" alt="${escapeHtml(
        name
      )} logo" />`
    : `<span class="footer-wordmark">${escapeHtml(name)}</span>`;

  return `
    <footer class="page-footer ${dark ? "page-footer--dark" : ""}">
      <div class="page-footer__left">${logoHtml}<span>${escapeHtml(name)}</span></div>
      <div class="page-footer__right"><span>${escapeHtml(email)}</span><span>Page ${pageNumber} of ${totalPages}</span></div>
    </footer>
  `;
}

function scoreCardHtml(input: {
  title: string;
  supportLabel: string;
  score: number;
  summary: string;
}) {
  const status = scoreTone(input.score);

  return `
    <article class="surface-card score-card">
      <div class="score-card__top">
        <p class="score-card__eyebrow">${escapeHtml(input.title)}</p>
        ${badgeHtml(status.label, status.tone)}
      </div>
      <div class="score-card__circle-wrap">
        <div class="score-circle" style="--circle-color:${status.tone.color};">${input.score}</div>
      </div>
      <div class="score-card__copy">
        <p class="score-card__support">${escapeHtml(input.supportLabel)}</p>
        <p class="score-card__summary">${escapeHtml(cleanCopy(input.summary))}</p>
      </div>
    </article>
  `;
}

function issueKey(value: string) {
  return cleanCopy(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function selectPdfIssues(narrative: ReportNarrative): PdfIssue[] {
  const recommendationMap = new Map(narrative.recommendations.map((item) => [item.insight.id, item]));
  const merged = new Map<
    string,
    {
      issue: ReportNarrative["issues"][number];
      recommendation: ReportNarrative["recommendations"][number] | undefined;
      device: "mobile" | "desktop" | "both" | null;
      scoreImpact: number;
    }
  >();

  for (const item of narrative.issues) {
    if (item.insight.priority === "Low") {
      continue;
    }

    const key = item.insight.category === "other" ? issueKey(item.ai.title) : item.insight.category;
    const recommendation = recommendationMap.get(item.insight.id);
    const existing = merged.get(key);

    if (!existing) {
      merged.set(key, {
        issue: item,
        recommendation,
        device: item.insight.device,
        scoreImpact: item.insight.scoreImpact
      });
      continue;
    }

    const shouldReplace =
      priorityRank(item.insight.priority) < priorityRank(existing.issue.insight.priority) ||
      (priorityRank(item.insight.priority) === priorityRank(existing.issue.insight.priority) &&
        item.insight.scoreImpact > existing.scoreImpact);

    merged.set(key, {
      issue: shouldReplace ? item : existing.issue,
      recommendation: shouldReplace ? recommendation : existing.recommendation,
      device:
        existing.device === "both" ||
        item.insight.device === "both" ||
        (existing.device && item.insight.device && existing.device !== item.insight.device)
          ? "both"
          : existing.device ?? item.insight.device,
      scoreImpact: Math.max(existing.scoreImpact, item.insight.scoreImpact)
    });
  }

  return Array.from(merged.values())
    .map((entry) => ({
      title: takeWords(entry.issue.ai.title || entry.issue.insight.title, 10),
      priority: entry.issue.insight.priority,
      what: takeSentences(withDeviceNote(entry.issue.ai.what_is_happening, entry.device), 2),
      why: takeSentences(entry.issue.ai.why_it_matters, 2),
      rootCause: takeSentences(entry.issue.ai.root_cause || entry.issue.insight.rootCause, 2),
      recommendation: takeSentences(
        entry.recommendation?.ai.action ||
          entry.issue.insight.relatedRecommendations[0]?.description ||
          entry.issue.insight.rootCause,
        2
      ),
      difficulty: entry.issue.insight.difficulty,
      time: cleanCopy(entry.issue.insight.timeToFix),
      scoreImpact: entry.scoreImpact
    }))
    .sort((left, right) => {
      const priorityDelta = priorityRank(left.priority) - priorityRank(right.priority);
      if (priorityDelta !== 0) {
        return priorityDelta;
      }

      return right.scoreImpact - left.scoreImpact;
    })
    .slice(0, 6);
}

function selectPdfRecommendations(narrative: ReportNarrative): PdfRecommendation[] {
  const deduplicated = new Map<
    string,
    {
      recommendation: ReportNarrative["recommendations"][number];
      scoreImpact: number;
    }
  >();

  for (const item of narrative.recommendations) {
    if (item.insight.priority === "Low") {
      continue;
    }

    const key = item.insight.category === "other" ? issueKey(item.ai.title) : item.insight.id;
    const existing = deduplicated.get(key);

    if (!existing) {
      deduplicated.set(key, {
        recommendation: item,
        scoreImpact: item.insight.scoreImpact
      });
      continue;
    }

    const shouldReplace =
      priorityRank(item.insight.priority) < priorityRank(existing.recommendation.insight.priority) ||
      (priorityRank(item.insight.priority) ===
        priorityRank(existing.recommendation.insight.priority) &&
        item.insight.scoreImpact > existing.scoreImpact);

    if (shouldReplace) {
      deduplicated.set(key, {
        recommendation: item,
        scoreImpact: item.insight.scoreImpact
      });
    }
  }

  return Array.from(deduplicated.values())
    .map((entry) => ({
      title: takeWords(entry.recommendation.ai.title || entry.recommendation.insight.title, 8),
      priority: entry.recommendation.insight.priority,
      action: takeSentences(entry.recommendation.ai.action, 2),
      impact: takeSentences(entry.recommendation.ai.expected_impact, 2),
      effort: entry.recommendation.ai.effort,
      time: cleanCopy(entry.recommendation.insight.timeToFix),
      scoreImpact: entry.scoreImpact
    }))
    .sort((left, right) => {
      const priorityDelta = priorityRank(left.priority) - priorityRank(right.priority);
      if (priorityDelta !== 0) {
        return priorityDelta;
      }

      return right.scoreImpact - left.scoreImpact;
    })
    .slice(0, 2);
}
function issueCardHtml(issue: PdfIssue) {
  return `
    <article class="surface-card issue-card">
      <div class="card-header-row">
        ${badgeHtml(issue.priority, priorityTone(issue.priority))}
        <div class="card-header-row__meta">
          ${metaChipHtml(`Estimated time: ${issue.time}`)}
          ${metaChipHtml(`Difficulty: ${difficultyLabel(issue.difficulty)}`)}
        </div>
      </div>
      <h2 class="card-title">${escapeHtml(issue.title)}</h2>
      <div class="issue-card__grid">
        <div class="detail-block">
          <p class="detail-block__label">What&#39;s happening</p>
          <p class="detail-block__copy">${escapeHtml(issue.what)}</p>
        </div>
        <div class="detail-block">
          <p class="detail-block__label">Why it matters</p>
          <p class="detail-block__copy">${escapeHtml(issue.why)}</p>
        </div>
        <div class="detail-block">
          <p class="detail-block__label">Root cause</p>
          <p class="detail-block__copy">${escapeHtml(issue.rootCause)}</p>
        </div>
        <div class="detail-block">
          <p class="detail-block__label">Recommended fix</p>
          <p class="detail-block__copy">${escapeHtml(issue.recommendation)}</p>
        </div>
      </div>
    </article>
  `;
}

function recommendationCardHtml(recommendation: PdfRecommendation) {
  return `
    <article class="surface-card recommendation-card">
      <div class="card-header-row">
        ${badgeHtml(recommendation.priority, priorityTone(recommendation.priority))}
        ${metaChipHtml(`${difficultyLabel(recommendation.effort)} - ${recommendation.time}`)}
      </div>
      <h3 class="card-title card-title--sm">${escapeHtml(recommendation.title)}</h3>
      <div class="detail-stack">
        <div class="detail-block detail-block--compact">
          <p class="detail-block__label">Action</p>
          <p class="detail-block__copy">${escapeHtml(recommendation.action)}</p>
        </div>
        <div class="detail-block detail-block--compact">
          <p class="detail-block__label">Expected impact</p>
          <p class="detail-block__copy">${escapeHtml(recommendation.impact)}</p>
        </div>
      </div>
    </article>
  `;
}

function planBoxHtml(title: string, expected: string, tasks: Array<{ task: string; time: string }>) {
  return `
    <article class="surface-card plan-box">
      <div class="plan-box__header">
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(cleanCopy(expected))}</p>
      </div>
      <div class="plan-box__tasks">
        ${tasks
          .map(
            (task) => `
              <div class="plan-task">
                <div class="plan-task__marker"></div>
                <div class="plan-task__copy">
                  <p class="plan-task__title">${escapeHtml(cleanCopy(task.task))}</p>
                  <p class="plan-task__time">Time: ${escapeHtml(cleanCopy(task.time))}</p>
                </div>
              </div>
            `
          )
          .join("")}
      </div>
    </article>
  `;
}

function measurementCardHtml(input: {
  icon: string;
  title: string;
  value: string;
  status: string;
  summary: string;
}) {
  const statusTone = /excellent|good|passing/i.test(input.status)
    ? tone(GREEN, GREEN_SOFT)
    : /watch|okay|average/i.test(input.status)
      ? tone(ORANGE, ORANGE_SOFT)
      : tone(RED, RED_SOFT);

  return `
    <article class="surface-card measurement-card">
      <div class="measurement-card__top">
        <p class="measurement-card__title">${input.icon} ${escapeHtml(input.title)}</p>
        ${badgeHtml(input.status, statusTone)}
      </div>
      <p class="measurement-card__value">${escapeHtml(cleanCopy(input.value))}</p>
      <p class="measurement-card__summary">${escapeHtml(cleanCopy(input.summary))}</p>
    </article>
  `;
}

function deviceCardHtml(input: {
  title: string;
  score: number;
  summary: string;
}) {
  const status = scoreTone(input.score);

  return `
    <article class="surface-card device-card">
      <div class="card-header-row">
        <p class="device-card__title">${escapeHtml(input.title)}</p>
        ${badgeHtml(status.label, status.tone)}
      </div>
      <div class="device-card__circle-wrap">
        <div class="score-circle" style="--circle-color:${status.tone.color};">${input.score}</div>
      </div>
      <div class="device-card__copy">
        <p class="device-card__support">${escapeHtml(
          input.title === "Mobile" ? "Mobile visitor experience" : "Desktop visitor experience"
        )}</p>
        <p class="device-card__summary">${escapeHtml(cleanCopy(input.summary))}</p>
      </div>
    </article>
  `;
}

function buildHtml(input: Context, narrative: ReportNarrative, logo: string | null) {
  const name = brandName(input);
  const email = contactEmail(input);
  const nextDate = nextReportDate(input);
  const health = healthLabel(input.scan, narrative.overview);
  const healthStatusTone = healthTone(health);
  const overall = overallScore(input.scan);
  const summary = takeSentences(
    `${narrative.overview.executive_sentences.join(" ")} ${narrative.overview.projected_summary}`,
    3
  );
  const issues = selectPdfIssues(narrative);
  const recommendations = selectPdfRecommendations(narrative);
  const issuePages = issues.length > 0 ? chunk(issues, 3) : [[]];
  const scoreCards = [
    scoreCardHtml({
      title: "Performance",
      supportLabel: SCORE_SUPPORT_LABELS.performance,
      score: input.scan.performance_score,
      summary: narrative.overview.score_summaries.performance.summary
    }),
    scoreCardHtml({
      title: "SEO",
      supportLabel: SCORE_SUPPORT_LABELS.seo,
      score: input.scan.seo_score,
      summary: narrative.overview.score_summaries.seo.summary
    }),
    scoreCardHtml({
      title: "Accessibility",
      supportLabel: SCORE_SUPPORT_LABELS.accessibility,
      score: input.scan.accessibility_score,
      summary: narrative.overview.score_summaries.accessibility.summary
    }),
    scoreCardHtml({
      title: "Best Practices",
      supportLabel: SCORE_SUPPORT_LABELS.bestPractices,
      score: input.scan.best_practices_score,
      summary: narrative.overview.score_summaries.best_practices.summary
    })
  ].join("");

  const scoreChanges = [
    {
      label: "Performance",
      value: input.previousScan ? input.scan.performance_score - input.previousScan.performance_score : 0
    },
    {
      label: "SEO",
      value: input.previousScan ? input.scan.seo_score - input.previousScan.seo_score : 0
    },
    {
      label: "Accessibility",
      value: input.previousScan
        ? input.scan.accessibility_score - input.previousScan.accessibility_score
        : 0
    },
    {
      label: "Best Practices",
      value: input.previousScan
        ? input.scan.best_practices_score - input.previousScan.best_practices_score
        : 0
    }
  ]
    .map((item) => {
      const isPositive = item.value > 0;
      const isNegative = item.value < 0;
      const changeTone = isPositive ? tone(GREEN, GREEN_SOFT) : isNegative ? tone(RED, RED_SOFT) : tone(BLUE, BLUE_SOFT);
      const arrow = isPositive ? "?" : isNegative ? "?" : "?";

      return `
        <div class="change-chip">
          <p class="change-chip__label">${escapeHtml(item.label)}</p>
          <span class="change-chip__value" style="color:${changeTone.color}; background:${changeTone.background}; border-color:${changeTone.border};">
            ${arrow} ${item.value > 0 ? "+" : ""}${item.value}
          </span>
        </div>
      `;
    })
    .join("");

  const planBoxes = narrative.overview.action_plan
    .slice(0, 3)
    .map((week) =>
      planBoxHtml(
        `${cleanCopy(week.phase)} - ${cleanCopy(week.focus)}`,
        week.expected_result,
        week.tasks.slice(0, 3)
      )
    )
    .join("");

  const recommendationCards = recommendations.length
    ? recommendations.map((item) => recommendationCardHtml(item)).join("")
    : `<article class="surface-card recommendation-card"><p class="empty-copy">There are no urgent recommendations to highlight right now.</p></article>`;

  const vitals = [
    measurementCardHtml({
      icon: "?",
      title: narrative.overview.vitals[0]?.title ?? "Page Load Speed",
      value:
        narrative.overview.vitals[0]?.value_label ??
        `${((input.scan.lcp ?? 0) / 1000).toFixed(2)} seconds`,
      status: narrative.overview.vitals[0]?.status_label ?? "Needs work",
      summary: narrative.overview.vitals[0]?.explanation ?? ""
    }),
    measurementCardHtml({
      icon: "??",
      title: narrative.overview.vitals[1]?.title ?? "Click Response",
      value: narrative.overview.vitals[1]?.value_label ?? `${Math.round(input.scan.fid ?? 0)} ms`,
      status: narrative.overview.vitals[1]?.status_label ?? "Needs work",
      summary: narrative.overview.vitals[1]?.explanation ?? ""
    }),
    measurementCardHtml({
      icon: "??",
      title: narrative.overview.vitals[2]?.title ?? "Visual Stability",
      value: narrative.overview.vitals[2]?.value_label ?? `${(input.scan.cls ?? 0).toFixed(4)}`,
      status: narrative.overview.vitals[2]?.status_label ?? "Needs work",
      summary: narrative.overview.vitals[2]?.explanation ?? ""
    })
  ].join("");

  const mobileScore = input.scan.mobile_snapshot?.performance_score ?? input.scan.performance_score;
  const desktopScore = input.scan.desktop_snapshot?.performance_score ?? input.scan.performance_score;

  const coverLogo = logo
    ? `<img class="cover-logo cover-logo--white" src="${logo}" alt="${escapeHtml(name)} logo" />`
    : `<div class="cover-wordmark">${escapeHtml(name)}</div>`;

  const contactLogo = logo
    ? `<img class="contact-logo contact-logo--white" src="${logo}" alt="${escapeHtml(name)} logo" />`
    : `<div class="contact-wordmark">${escapeHtml(name)}</div>`;

  const pages: PdfPage[] = [
    {
      dark: true,
      content: `
        <div class="cover-page">
          <div class="cover-page__top">
            ${coverLogo}
            <p class="cover-page__agency">${escapeHtml(name)}</p>
          </div>
          <div class="cover-page__middle">
            <p class="cover-page__kicker">Monthly Website Report</p>
            <h1 class="cover-page__url">${escapeHtml(input.website.url)}</h1>
            <p class="cover-page__date">${escapeHtml(formatDateTime(input.scan.scanned_at))}</p>
          </div>
          <div class="surface-card cover-page__meta">
            <div>
              <p class="meta-label">Prepared for</p>
              <p class="meta-value">${escapeHtml(input.website.label)}</p>
            </div>
            <div>
              <p class="meta-label">Prepared by</p>
              <p class="meta-value">${escapeHtml(name)}</p>
            </div>
            <div class="meta-divider"></div>
            <div>
              <p class="meta-label">Next report date</p>
              <p class="meta-value">${escapeHtml(nextDate)}</p>
            </div>
          </div>
        </div>
      `
    },
    {
      content: `
        <div class="page-stack">
          ${sectionHeaderHtml({
            eyebrow: "Executive Summary",
            title: "Executive Summary",
            subtitle: "A clear, client-ready view of your latest website health report."
          })}
          <section class="surface-card health-card">
            <div class="health-card__top">
              ${badgeHtml(health, healthStatusTone, "pill--lg")}
              <div class="health-card__score">
                <span>Overall score</span>
                <strong>${overall}/100</strong>
              </div>
            </div>
            <p class="health-card__summary">${escapeHtml(summary)}</p>
          </section>
          <section class="score-grid">${scoreCards}</section>
          <section class="executive-grid">
            <article class="surface-card section-card">
              <div class="section-card__header">
                <h2>Score Changes</h2>
                <p>${escapeHtml(cleanCopy(narrative.overview.changes_summary))}</p>
              </div>
              <div class="changes-grid">${scoreChanges}</div>
            </article>
            <article class="surface-card section-card">
              <div class="section-card__header">
                <h2>Industry Comparison</h2>
                <p>Your latest scan compared against a typical industry benchmark.</p>
              </div>
              <div class="comparison-stack">
                <div class="comparison-row">
                  <span>Your site</span>
                  <div class="progress-track"><div class="progress-fill progress-fill--brand" style="width:${overall}%;"></div></div>
                  <strong>${overall}</strong>
                </div>
                <div class="comparison-row">
                  <span>Industry</span>
                  <div class="progress-track"><div class="progress-fill progress-fill--muted" style="width:${INDUSTRY_SCORE}%;"></div></div>
                  <strong>${INDUSTRY_SCORE}</strong>
                </div>
              </div>
            </article>
          </section>
        </div>
      `
    },
    ...issuePages.map((pageIssues, index) => ({
      content: `
        <div class="page-stack">
          ${sectionHeaderHtml({
            eyebrow: index === 0 ? "Issues Found" : "More Findings",
            title: index === 0 ? "What Needs Attention" : "Additional Findings",
            subtitle:
              index === 0
                ? "These are the highest-impact issues to discuss with your client or developer next."
                : "The next most important fixes once the urgent work is underway."
          })}
          <section class="issue-stack">
            ${
              pageIssues.length
                ? pageIssues.map((item) => issueCardHtml(item)).join("")
                : `<article class="surface-card issue-empty-card"><p class="empty-copy">Your latest scan did not surface any urgent issues that need immediate attention.</p></article>`
            }
          </section>
        </div>
      `
    })),
    {
      content: `
        <div class="page-stack">
          ${sectionHeaderHtml({
            eyebrow: "Recommendations",
            title: "Your 30-Day Plan",
            subtitle: cleanCopy(narrative.overview.action_plan_intro)
          })}
          <section class="plan-layout">
            <div class="plan-layout__main">
              ${planBoxes}
            </div>
            <aside class="plan-layout__side">
              <div class="side-section">
                <div class="side-section__header">
                  <p class="side-section__eyebrow">Priority Recommendations</p>
                  <h2>Recommended next actions</h2>
                </div>
                <div class="recommendation-stack">
                  ${recommendationCards}
                </div>
              </div>
              <article class="surface-card outcome-card">
                <div class="section-card__header">
                  <h2>Expected Outcome</h2>
                  <p>${escapeHtml(cleanCopy(narrative.overview.projected_summary))}</p>
                </div>
                <div class="outcome-metrics">
                  <div class="outcome-metric">
                    <span>Current score</span>
                    <strong>${overall}/100</strong>
                  </div>
                  <div class="outcome-metric">
                    <span>Projected range</span>
                    <strong>${escapeHtml(cleanCopy(narrative.overview.projected_score_range))}/100</strong>
                  </div>
                </div>
              </article>
            </aside>
          </section>
        </div>
      `
    },
    {
      content: `
        <div class="page-stack">
          ${sectionHeaderHtml({
            eyebrow: "Google's Health Checks",
            title: "Google's Health Checks",
            subtitle: cleanCopy(narrative.overview.vitals_intro)
          })}
          <section class="measurements-grid">${vitals}</section>
          <section class="surface-card summary-card">
            <p>${escapeHtml(
              takeSentences(`${narrative.overview.vitals_overall}`, 2)
            )}</p>
          </section>
        </div>
      `
    },
    {
      content: `
        <div class="page-stack">
          ${sectionHeaderHtml({
            eyebrow: "Device Comparison",
            title: "Mobile vs Desktop",
            subtitle: cleanCopy(narrative.overview.device_intro)
          })}
          <section class="device-grid">
            ${deviceCardHtml({
              title: "Mobile",
              score: mobileScore,
              summary: narrative.overview.mobile_summary
            })}
            ${deviceCardHtml({
              title: "Desktop",
              score: desktopScore,
              summary: narrative.overview.desktop_summary
            })}
          </section>
          <section class="surface-card summary-card">
            <p>${escapeHtml(cleanCopy(narrative.overview.device_tip))}</p>
          </section>
        </div>
      `
    },
    {
      dark: true,
      content: `
        <div class="contact-page">
          ${contactLogo}
          <h1>Thank you for choosing ${escapeHtml(name)}</h1>
          <div class="contact-divider"></div>
          <p class="contact-page__prompt">Questions about this report?</p>
          <a class="contact-page__email" href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>
          <div class="contact-divider"></div>
          <p class="contact-page__prompt">Your next report will be delivered:</p>
          <p class="contact-page__date">${escapeHtml(nextDate)}</p>
          <div class="contact-divider"></div>
          <p class="contact-page__note">Report generated by ${escapeHtml(name)} using SitePulse monitoring</p>
        </div>
      `
    }
  ];

  const totalPages = pages.length;
  const css = `
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      font-family: Inter, Manrope, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: ${SLATE_950};
      background: ${SURFACE};
      -webkit-font-smoothing: antialiased;
    }
    body {
      font-size: 13px;
      line-height: 1.6;
    }
    p, h1, h2, h3, h4, span, strong {
      max-width: 100%;
      overflow-wrap: break-word;
      word-break: normal;
    }
    .page {
      width: 210mm;
      min-height: 297mm;
      padding: 17mm 17mm 14mm;
      display: flex;
      flex-direction: column;
      page-break-after: always;
      background: ${SURFACE};
      overflow: hidden;
    }
    .page:last-child {
      page-break-after: auto;
    }
    .page--dark {
      background: ${NAVY};
      color: #F8FAFC;
    }
    .page-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 18px;
      min-width: 0;
      min-height: 0;
    }
    .page-stack {
      display: flex;
      flex-direction: column;
      gap: 18px;
      min-width: 0;
      min-height: 0;
    }
    .surface-card {
      min-width: 0;
      border-radius: 22px;
      border: 1px solid ${BORDER};
      background: ${SURFACE};
      box-shadow: ${SHADOW};
      padding: 24px;
      overflow: hidden;
      break-inside: avoid;
    }
    .section-header {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin: 0;
    }
    .section-header__eyebrow {
      margin: 0;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: ${BLUE};
    }
    .section-header h1 {
      margin: 0;
      font-size: 28px;
      line-height: 1.18;
      color: ${SLATE_950};
    }
    .section-header__subtitle {
      margin: 0;
      font-size: 14px;
      line-height: 1.7;
      color: ${SLATE_600};
    }
    .pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: fit-content;
      min-height: 30px;
      padding: 6px 14px;
      border-radius: 999px;
      border: 1px solid var(--pill-border);
      background: var(--pill-bg);
      color: var(--pill-color);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      white-space: nowrap;
    }
    .pill--lg {
      min-height: 36px;
      padding: 9px 18px;
      font-size: 12px;
      letter-spacing: 0.12em;
    }
    .pill--meta {
      font-size: 10px;
      letter-spacing: 0.06em;
      text-transform: none;
      font-weight: 600;
    }
    .card-header-row {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 10px;
      flex-wrap: wrap;
    }
    .card-header-row__meta {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
    .card-title {
      margin: 14px 0 0;
      font-size: 20px;
      line-height: 1.28;
      color: ${SLATE_950};
    }
    .card-title--sm {
      font-size: 18px;
      margin-top: 12px;
    }
    .section-card__header {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 16px;
    }
    .section-card__header h2,
    .side-section__header h2,
    .plan-box__header h3 {
      margin: 0;
      font-size: 18px;
      line-height: 1.25;
      color: ${SLATE_950};
    }
    .section-card__header p,
    .side-section__header p,
    .plan-box__header p,
    .summary-card p,
    .empty-copy {
      margin: 0;
      font-size: 13px;
      line-height: 1.7;
      color: ${SLATE_700};
    }
    .health-card {
      display: flex;
      flex-direction: column;
      gap: 18px;
    }
    .health-card__top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
    }
    .health-card__score {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 4px;
      text-align: right;
    }
    .health-card__score span {
      font-size: 11px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: ${SLATE_600};
    }
    .health-card__score strong {
      font-size: 30px;
      line-height: 1;
      color: ${SLATE_950};
    }
    .health-card__summary {
      margin: 0;
      font-size: 14px;
      line-height: 1.78;
      color: ${SLATE_700};
    }
    .score-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
    }
    .score-card {
      display: flex;
      flex-direction: column;
      gap: 16px;
      align-items: stretch;
      text-align: left;
    }
    .score-card__top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }
    .score-card__eyebrow {
      margin: 0;
      font-size: 12px;
      line-height: 1.4;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: ${SLATE_600};
    }
    .score-card__circle-wrap,
    .device-card__circle-wrap {
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 2px 0;
    }
    .score-circle {
      width: 88px;
      height: 88px;
      border-radius: 50%;
      border: 6px solid var(--circle-color);
      color: var(--circle-color);
      background: ${SURFACE};
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      font-weight: 800;
      line-height: 1;
      flex-shrink: 0;
    }
    .score-card__copy,
    .device-card__copy {
      display: flex;
      flex-direction: column;
      gap: 8px;
      align-items: center;
      text-align: center;
    }
    .score-card__support,
    .device-card__support {
      margin: 0;
      font-size: 13px;
      font-weight: 700;
      color: ${SLATE_900};
    }
    .score-card__summary,
    .device-card__summary,
    .measurement-card__summary {
      margin: 0;
      font-size: 13px;
      line-height: 1.7;
      color: ${SLATE_700};
    }
    .executive-grid {
      display: grid;
      grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
      gap: 16px;
    }
    .changes-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }
    .change-chip {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      min-width: 0;
      padding: 14px 16px;
      border-radius: 16px;
      border: 1px solid ${BORDER};
      background: ${SURFACE_SOFT};
    }
    .change-chip__label {
      margin: 0;
      font-size: 12px;
      font-weight: 600;
      color: ${SLATE_700};
    }
    .change-chip__value {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 28px;
      padding: 4px 12px;
      border-radius: 999px;
      border: 1px solid;
      font-size: 12px;
      font-weight: 700;
      white-space: nowrap;
    }
    .comparison-stack {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .comparison-row {
      display: grid;
      grid-template-columns: 68px minmax(0, 1fr) 34px;
      align-items: center;
      gap: 12px;
      font-size: 13px;
      color: ${SLATE_700};
    }
    .comparison-row strong {
      text-align: right;
      color: ${SLATE_950};
    }
    .progress-track {
      height: 12px;
      border-radius: 999px;
      background: #E2E8F0;
      overflow: hidden;
      border: 1px solid rgba(148,163,184,0.18);
    }
    .progress-fill {
      height: 100%;
      border-radius: inherit;
    }
    .progress-fill--brand {
      background: linear-gradient(90deg, ${BLUE}, #60A5FA);
    }
    .progress-fill--muted {
      background: linear-gradient(90deg, ${SLATE_500}, ${SLATE_300});
    }
    .issue-stack,
    .recommendation-stack,
    .plan-layout__main {
      display: flex;
      flex-direction: column;
      gap: 16px;
      min-width: 0;
    }
    .issue-card__grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px 16px;
      margin-top: 16px;
    }
    .detail-stack {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-top: 14px;
    }
    .detail-block {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-width: 0;
      padding: 14px 16px;
      border-radius: 16px;
      border: 1px solid ${BORDER};
      background: ${SURFACE_SOFT};
    }
    .detail-block--compact {
      padding: 13px 14px;
    }
    .detail-block__label {
      margin: 0;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: ${SLATE_600};
    }
    .detail-block__copy {
      margin: 0;
      font-size: 13px;
      line-height: 1.65;
      color: ${SLATE_700};
    }
    .issue-empty-card {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 150px;
      text-align: center;
    }
    .plan-layout {
      display: grid;
      grid-template-columns: minmax(0, 1.4fr) minmax(0, 0.95fr);
      gap: 18px;
      align-items: start;
    }
    .plan-layout__side {
      display: flex;
      flex-direction: column;
      gap: 16px;
      min-width: 0;
    }
    .side-section {
      display: flex;
      flex-direction: column;
      gap: 14px;
      min-width: 0;
    }
    .side-section__eyebrow {
      margin: 0;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: ${BLUE};
    }
    .plan-box {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .plan-box__tasks {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .plan-task {
      display: grid;
      grid-template-columns: 14px minmax(0, 1fr);
      gap: 10px;
      align-items: start;
    }
    .plan-task__marker {
      width: 10px;
      height: 10px;
      margin-top: 5px;
      border-radius: 999px;
      background: ${BLUE};
      box-shadow: 0 0 0 4px ${BLUE_SOFT};
    }
    .plan-task__copy {
      min-width: 0;
    }
    .plan-task__title,
    .plan-task__time {
      margin: 0;
      font-size: 13px;
      line-height: 1.6;
    }
    .plan-task__title {
      font-weight: 600;
      color: ${SLATE_900};
    }
    .plan-task__time {
      color: ${SLATE_600};
    }
    .recommendation-card {
      padding: 20px;
    }
    .outcome-card {
      background: ${SURFACE_TINT};
      border-color: rgba(37,99,235,0.18);
    }
    .outcome-metrics {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      margin-top: 16px;
    }
    .outcome-metric {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 14px 16px;
      border-radius: 16px;
      border: 1px solid rgba(37,99,235,0.14);
      background: rgba(255,255,255,0.72);
    }
    .outcome-metric span {
      font-size: 11px;
      letter-spacing: 0.10em;
      text-transform: uppercase;
      color: ${SLATE_600};
    }
    .outcome-metric strong {
      font-size: 24px;
      line-height: 1.1;
      color: ${SLATE_950};
    }
    .measurements-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 16px;
    }
    .measurement-card {
      display: flex;
      flex-direction: column;
      gap: 16px;
      min-height: 0;
    }
    .measurement-card__top {
      display: flex;
      flex-direction: column;
      gap: 12px;
      align-items: flex-start;
    }
    .measurement-card__title {
      margin: 0;
      font-size: 16px;
      line-height: 1.35;
      font-weight: 700;
      color: ${SLATE_950};
    }
    .measurement-card__value {
      margin: 0;
      font-size: 30px;
      line-height: 1;
      font-weight: 800;
      color: ${SLATE_950};
    }
    .summary-card {
      background: ${SURFACE_TINT};
      border-color: rgba(37,99,235,0.18);
    }
    .summary-card p {
      color: #1E40AF;
    }
    .device-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 18px;
    }
    .device-card {
      display: flex;
      flex-direction: column;
      gap: 16px;
      min-height: 0;
    }
    .device-card__title {
      margin: 0;
      font-size: 18px;
      font-weight: 700;
      color: ${SLATE_950};
    }
    .page-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin-top: auto;
      padding-top: 12px;
      border-top: 1px solid ${BORDER};
      font-size: 11px;
      color: ${SLATE_600};
    }
    .page-footer--dark {
      color: rgba(241,245,249,0.82);
      border-top-color: rgba(255,255,255,0.14);
    }
    .page-footer__left,
    .page-footer__right {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }
    .page-footer__right {
      margin-left: auto;
    }
    .footer-logo,
    .contact-logo,
    .cover-logo {
      display: block;
      object-fit: contain;
    }
    .footer-logo {
      width: 22px;
      height: 22px;
    }
    .contact-logo,
    .cover-logo {
      width: 92px;
      height: 92px;
    }
    .footer-logo--white,
    .contact-logo--white,
    .cover-logo--white {
      filter: brightness(0) invert(1);
    }
    .footer-wordmark,
    .cover-wordmark,
    .contact-wordmark {
      font-weight: 700;
      letter-spacing: 0.03em;
    }
    .cover-page,
    .contact-page {
      display: flex;
      flex: 1;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      min-width: 0;
    }
    .cover-page {
      justify-content: space-between;
      padding: 4mm 0 1mm;
    }
    .cover-page__top {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 20px;
    }
    .cover-page__agency {
      margin: 0;
      font-size: 18px;
      letter-spacing: 0.04em;
      color: #F8FAFC;
    }
    .cover-page__middle {
      display: flex;
      flex-direction: column;
      gap: 12px;
      align-items: center;
      max-width: 140mm;
    }
    .cover-page__kicker {
      margin: 0;
      color: #E2E8F0;
      font-size: 28px;
      font-weight: 300;
    }
    .cover-page__url {
      margin: 0;
      font-size: 19px;
      line-height: 1.45;
      color: #60A5FA;
      font-weight: 700;
    }
    .cover-page__date {
      margin: 0;
      font-size: 14px;
      color: #94A3B8;
    }
    .cover-page__meta {
      width: 100%;
      text-align: left;
      background: rgba(255,255,255,0.97);
      box-shadow: none;
    }
    .meta-label {
      margin: 0;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: ${SLATE_600};
    }
    .meta-value {
      margin: 6px 0 0;
      font-size: 16px;
      line-height: 1.45;
      font-weight: 600;
      color: ${SLATE_950};
    }
    .meta-divider,
    .contact-divider {
      width: 100%;
      height: 1px;
      margin: 18px 0;
      background: rgba(148,163,184,0.28);
    }
    .contact-page {
      gap: 18px;
    }
    .contact-page h1 {
      margin: 0;
      font-size: 30px;
      line-height: 1.24;
      color: #F8FAFC;
      max-width: 140mm;
    }
    .contact-page__prompt {
      margin: 0;
      font-size: 16px;
      color: #CBD5E1;
    }
    .contact-page__email {
      color: #60A5FA;
      font-size: 26px;
      font-weight: 700;
      text-decoration: none;
      line-height: 1.3;
    }
    .contact-page__date {
      margin: 0;
      font-size: 28px;
      font-weight: 700;
      color: #60A5FA;
    }
    .contact-page__note {
      margin: 0;
      font-size: 12px;
      color: #CBD5E1;
    }
  `;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><style>${css}</style></head><body>${pages
    .map(
      (page, index) => `
        <section class="page ${page.dark ? "page--dark" : ""}">
          <div class="page-content">${page.content}</div>
          ${footerHtml(index + 1, totalPages, name, email, logo, page.dark)}
        </section>
      `
    )
    .join("")}</body></html>`;
}

export async function renderAiReportPdf(input: Context) {
  const narrative = await buildReportNarrative({
    website: input.website,
    scan: input.scan,
    previousScan: input.previousScan,
    branding: input.branding ?? null,
    profile: input.profile
  });
  const logo = input.branding?.logo_url
    ? await fetchImageAsDataUrl(input.branding.logo_url).catch(() => null)
    : null;
  const html = buildHtml(input, narrative, logo);

  const { default: puppeteer } = await import("puppeteer");
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 1697, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: "networkidle0" });
    await page.emulateMediaType("screen");

    const pdf = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" }
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
