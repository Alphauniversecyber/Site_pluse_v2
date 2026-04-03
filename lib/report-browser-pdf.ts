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
const BLUE = "#3B82F6";
const GREEN = "#22C55E";
const ORANGE = "#F59E0B";
const RED = "#EF4444";
const INDUSTRY_SCORE = 78;
const BANNED_TERMS = /\b(LCP|FID|CLS|TBT|TTFB|INP|DOM|API|CDN|HTTP|CSS|JS)\b/gi;

type Context = {
  website: Website;
  scan: ScanResult;
  previousScan: ScanResult | null;
  history: ScanResult[];
  branding?: AgencyBranding | null;
  profile: UserProfile;
  schedule?: ScanSchedule | null;
};

type PdfPage = { dark?: boolean; content: string };
type PdfIssue = {
  title: string;
  priority: ReportPriority;
  what: string;
  why: string;
  how: string;
  difficulty: "Easy" | "Medium" | "Hard";
  time: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function cleanCopy(value: string) {
  return value
    .replace(BANNED_TERMS, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,!?;:])/g, "$1")
    .trim();
}

function truncateText(value: string, maxLength: number) {
  const clean = cleanCopy(value);
  if (clean.length <= maxLength) {
    return clean;
  }

  const sentences = clean.split(/(?<=[.!?])\s+/).filter(Boolean);
  let fitted = "";
  for (const sentence of sentences) {
    const next = fitted ? `${fitted} ${sentence}` : sentence;
    if (next.length > maxLength) {
      break;
    }
    fitted = next;
  }

  if (fitted) {
    return fitted;
  }

  const shortened = clean.slice(0, Math.max(0, maxLength - 3));
  const boundary = shortened.search(/\s+\S*$/);
  const safe = boundary > 18 ? shortened.slice(0, boundary) : shortened;
  return `${safe.trim()}...`;
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
  return input.branding?.agency_name || input.branding?.email_from_name || input.profile.full_name || "Your Agency";
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

function healthLabel(scan: ScanResult, narrative: ReportNarrative["overview"]) {
  if (narrative.overall_health === "EXCELLENT") {
    return "EXCELLENT";
  }

  const score = overallScore(scan);
  if (score >= 90 && scan.performance_score >= 85) {
    return "EXCELLENT";
  }

  return narrative.overall_health;
}

function healthTone(label: string) {
  if (label === "EXCELLENT") return { color: GREEN, bg: "rgba(34,197,94,0.12)" };
  if (label === "GOOD") return { color: BLUE, bg: "rgba(59,130,246,0.12)" };
  if (label === "NEEDS ATTENTION") return { color: ORANGE, bg: "rgba(245,158,11,0.14)" };
  return { color: RED, bg: "rgba(239,68,68,0.14)" };
}

function scoreTone(score: number) {
  if (score >= 90) return { color: GREEN, label: "Excellent", icon: "&#9989;" };
  if (score >= 50) return { color: ORANGE, label: "Needs attention", icon: "&#128993;" };
  return { color: RED, label: "Critical", icon: "&#128308;" };
}

function issueTheme(priority: ReportPriority) {
  if (priority === "Critical" || priority === "High") {
    return { color: RED, label: "HIGH PRIORITY", icon: "&#128308;" };
  }
  if (priority === "Medium") {
    return { color: ORANGE, label: "MEDIUM PRIORITY", icon: "&#128993;" };
  }
  return { color: GREEN, label: "LOW PRIORITY", icon: "&#128994;" };
}

function issueKey(value: string) {
  return cleanCopy(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function withDeviceNote(value: string, device: "mobile" | "desktop" | "both" | null) {
  if (device !== "both" || /both mobile and desktop/i.test(value)) {
    return value;
  }

  return `${value} This affects both mobile and desktop versions.`;
}

function selectPdfIssues(narrative: ReportNarrative) {
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
    const existing = merged.get(key);
    const recommendation = recommendationMap.get(item.insight.id);

    if (!existing) {
      merged.set(key, {
        issue: item,
        recommendation,
        device: item.insight.device,
        scoreImpact: item.insight.scoreImpact
      });
      continue;
    }

    const higherPriority =
      priorityRank(item.insight.priority) < priorityRank(existing.issue.insight.priority) ||
      (priorityRank(item.insight.priority) === priorityRank(existing.issue.insight.priority) &&
        item.insight.scoreImpact > existing.scoreImpact);

    merged.set(key, {
      issue: higherPriority ? item : existing.issue,
      recommendation: higherPriority ? recommendation : existing.recommendation,
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
      title: truncateText(entry.issue.ai.title || entry.issue.insight.title, 50),
      priority: entry.issue.insight.priority,
      what: truncateText(withDeviceNote(entry.issue.ai.what_is_happening, entry.device), 120),
      why: truncateText(entry.issue.ai.why_it_matters, 100),
      how: truncateText(
        entry.recommendation?.ai.action ||
          entry.issue.insight.relatedRecommendations[0]?.description ||
          entry.issue.insight.rootCause,
        120
      ),
      difficulty: entry.issue.insight.difficulty,
      time: entry.issue.insight.timeToFix,
      scoreImpact: entry.scoreImpact
    }))
    .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || b.scoreImpact - a.scoreImpact)
    .slice(0, 6)
    .map(({ scoreImpact: _scoreImpact, ...item }) => item);
}

function footerHtml(pageNumber: number, totalPages: number, name: string, email: string, logo: string | null, dark?: boolean) {
  const logoHtml = logo
    ? `<img class="footer-logo ${dark ? "footer-logo--white" : ""}" src="${logo}" alt="${escapeHtml(name)} logo" />`
    : `<span class="footer-wordmark">${escapeHtml(name)}</span>`;

  return `
    <footer class="page-footer ${dark ? "page-footer--dark" : ""}">
      <div class="page-footer__left">${logoHtml}<span>${escapeHtml(name)}</span></div>
      <div class="page-footer__right"><span>${escapeHtml(email)}</span><span>Page ${pageNumber} of ${totalPages}</span></div>
    </footer>
  `;
}

function scoreCardHtml(title: string, score: number, status: string, summary: string) {
  const tone = scoreTone(score);
  return `
    <article class="card score-card">
      <p class="score-card__eyebrow">${escapeHtml(title)}</p>
      <div class="score-circle" style="border-color:${tone.color}; color:${tone.color};">${score}</div>
      <p class="score-card__status" style="color:${tone.color};">${escapeHtml(status)} <span>${tone.icon}</span></p>
      <p class="score-card__summary">${escapeHtml(summary)}</p>
    </article>
  `;
}

function issueCardHtml(issue: PdfIssue) {
  const theme = issueTheme(issue.priority);
  return `
    <article class="card issue-card">
      <div class="issue-card__priority" style="color:${theme.color};"><span>${theme.icon}</span><span>${theme.label}</span></div>
      <h3 class="issue-card__title">${escapeHtml(issue.title)}</h3>
      <div class="issue-card__section"><p class="issue-card__label">What's happening:</p><p class="issue-card__copy">${escapeHtml(issue.what)}</p></div>
      <div class="issue-card__section issue-card__section--compact"><p class="issue-card__label">Why it matters:</p><p class="issue-card__copy">${escapeHtml(issue.why)}</p></div>
      <div class="issue-card__section"><p class="issue-card__label">How to fix it:</p><p class="issue-card__copy">${escapeHtml(issue.how)}</p></div>
      <div class="issue-card__meta"><span>Estimated time: ${escapeHtml(issue.time)}</span><span>Difficulty: ${escapeHtml(issue.difficulty)}</span></div>
    </article>
  `;
}

function planBoxHtml(title: string, expected: string, tasks: Array<{ task: string; time: string }>) {
  return `
    <article class="card plan-box">
      <div class="plan-box__header"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(expected)}</p></div>
      <div class="plan-box__tasks">
        ${tasks
          .map(
            (task) => `<div class="plan-task"><div class="plan-task__checkbox">&#9633;</div><div class="plan-task__content"><p class="plan-task__title">${escapeHtml(task.task)}</p><p class="plan-task__time">Time: ${escapeHtml(task.time)}</p></div></div>`
          )
          .join("")}
      </div>
    </article>
  `;
}

function vitalsCardHtml(icon: string, title: string, value: string, status: string, summary: string) {
  const lowerStatus = status.toLowerCase();
  const color =
    lowerStatus.includes("excellent") || lowerStatus.includes("good") || lowerStatus.includes("passing")
      ? GREEN
      : lowerStatus.includes("watch") || lowerStatus.includes("okay")
        ? ORANGE
        : RED;

  return `
    <article class="card vitals-card">
      <p class="vitals-card__title">${icon} ${escapeHtml(title)}</p>
      <p class="vitals-card__value">${escapeHtml(value)}</p>
      <p class="vitals-card__status" style="color:${color};">${escapeHtml(status)}</p>
      <p class="vitals-card__summary">${escapeHtml(summary)}</p>
    </article>
  `;
}

function deviceCardHtml(icon: string, title: string, score: number, summary: string) {
  const tone = scoreTone(score);
  return `
    <article class="card device-card">
      <p class="device-card__title">${icon} ${escapeHtml(title)}</p>
      <div class="score-circle" style="border-color:${tone.color}; color:${tone.color};">${score}</div>
      <p class="device-card__status" style="color:${tone.color};"><span>${tone.icon}</span> ${escapeHtml(tone.label)}</p>
      <p class="device-card__summary">${escapeHtml(summary)}</p>
    </article>
  `;
}

function buildHtml(input: Context, narrative: ReportNarrative, logo: string | null) {
  const name = brandName(input);
  const email = contactEmail(input);
  const nextDate = nextReportDate(input);
  const health = healthLabel(input.scan, narrative.overview);
  const healthColors = healthTone(health);
  const score = overallScore(input.scan);
  const summary = truncateText(
    `${narrative.overview.executive_sentences.join(" ")} If you act on the top fixes, your overall score could move toward ${narrative.overview.projected_score_range}.`,
    200
  );
  const issues = selectPdfIssues(narrative);
  const issuePages = issues.length > 3 ? [issues.slice(0, 3), issues.slice(3, 6)] : [issues.slice(0, 3)];
  const coverLogo = logo
    ? `<img class="cover-logo cover-logo--white" src="${logo}" alt="${escapeHtml(name)} logo" />`
    : `<div class="cover-wordmark">${escapeHtml(name)}</div>`;
  const footerContactLogo = logo
    ? `<img class="contact-logo contact-logo--white" src="${logo}" alt="${escapeHtml(name)} logo" />`
    : `<div class="contact-wordmark">${escapeHtml(name)}</div>`;
  const scoreCards = [
    scoreCardHtml("Performance", input.scan.performance_score, narrative.overview.score_summaries.performance.label, truncateText(narrative.overview.score_summaries.performance.summary, 75)),
    scoreCardHtml("SEO", input.scan.seo_score, narrative.overview.score_summaries.seo.label, truncateText(narrative.overview.score_summaries.seo.summary, 75)),
    scoreCardHtml("Accessibility", input.scan.accessibility_score, narrative.overview.score_summaries.accessibility.label, truncateText(narrative.overview.score_summaries.accessibility.summary, 75)),
    scoreCardHtml("Best Practices", input.scan.best_practices_score, narrative.overview.score_summaries.best_practices.label, truncateText(narrative.overview.score_summaries.best_practices.summary, 75))
  ].join("");
  const changes = [
    { label: "Performance", value: input.previousScan ? input.scan.performance_score - input.previousScan.performance_score : 0 },
    { label: "SEO", value: input.previousScan ? input.scan.seo_score - input.previousScan.seo_score : 0 },
    { label: "Accessibility", value: input.previousScan ? input.scan.accessibility_score - input.previousScan.accessibility_score : 0 }
  ]
    .map((item) => {
      const arrow = item.value > 0 ? "&#8593;" : item.value < 0 ? "&#8595;" : "&#8594;";
      return `<span>${escapeHtml(item.label)}: ${arrow} ${item.value > 0 ? "+" : ""}${item.value}</span>`;
    })
    .join('<span class="changes-separator">|</span>');
  const planBoxes = narrative.overview.action_plan.slice(0, 3).map((week) =>
    planBoxHtml(
      `${truncateText(week.phase, 18)} - ${truncateText(week.focus, 22)}`,
      truncateText(week.expected_result, 70),
      week.tasks.slice(0, 2).map((task) => ({
        task: truncateText(task.task, 42),
        time: truncateText(task.time, 22)
      }))
    )
  ).join("");
  const vitals = [
    vitalsCardHtml("&#9889;", "Speed", narrative.overview.vitals[0]?.value_label ?? `${((input.scan.lcp ?? 0) / 1000).toFixed(2)}s`, narrative.overview.vitals[0]?.status_label ?? "Needs work", truncateText(narrative.overview.vitals[0]?.explanation ?? "", 85)),
    vitalsCardHtml("&#128070;", "Response", narrative.overview.vitals[1]?.value_label ?? `${Math.round(input.scan.fid ?? 0)}ms`, narrative.overview.vitals[1]?.status_label ?? "Needs work", truncateText(narrative.overview.vitals[1]?.explanation ?? "", 85)),
    vitalsCardHtml("&#128208;", "Stability", narrative.overview.vitals[2]?.value_label ?? `${(input.scan.cls ?? 0).toFixed(4)}`, narrative.overview.vitals[2]?.status_label ?? "Needs work", truncateText(narrative.overview.vitals[2]?.explanation ?? "", 85))
  ].join("");
  const mobileScore = input.scan.mobile_snapshot?.performance_score ?? input.scan.performance_score;
  const desktopScore = input.scan.desktop_snapshot?.performance_score ?? input.scan.performance_score;

  const pages: PdfPage[] = [
    {
      dark: true,
      content: `<div class="cover-page"><div class="cover-top">${coverLogo}<p class="cover-agency">${escapeHtml(name)}</p></div><div class="cover-middle"><p class="cover-kicker">Monthly Website Report</p><h1 class="cover-url">${escapeHtml(input.website.url)}</h1><p class="cover-date">${escapeHtml(formatDateTime(input.scan.scanned_at))}</p></div><div class="cover-bottom card cover-bottom-card"><div><p class="cover-meta-label">Prepared for</p><p class="cover-meta-value">${escapeHtml(input.website.label)}</p></div><div><p class="cover-meta-label">Prepared by</p><p class="cover-meta-value">${escapeHtml(name)}</p></div><hr /><div><p class="cover-meta-label">Next report date</p><p class="cover-meta-value">${escapeHtml(nextDate)}</p></div></div></div>`
    },
    {
      content: `<div class="page-section"><div class="section-heading"><h1>Executive Summary</h1></div><section class="card health-card"><div class="health-badge" style="color:${healthColors.color}; background:${healthColors.bg}; border-color:${healthColors.color};">${escapeHtml(health)}</div><p class="health-summary">${escapeHtml(summary)}</p></section><section class="score-grid">${scoreCards}</section><section class="card changes-card"><h2>Score Changes</h2><div class="changes-row">${changes}</div></section><section class="card comparison-card"><h2>Industry Comparison</h2><div class="comparison-row"><span>Your site</span><div class="progress-track"><div class="progress-fill" style="width:${score}%; background:${BLUE};"></div></div><span>${score}</span></div><div class="comparison-row"><span>Industry</span><div class="progress-track"><div class="progress-fill" style="width:${INDUSTRY_SCORE}%; background:rgba(15,23,42,0.25);"></div></div><span>${INDUSTRY_SCORE}</span></div></section></div>`
    },
    ...issuePages.map((pageIssues, index) => ({
      content: `<div class="page-section"><div class="section-heading"><h1>${index === 0 ? "What Needs Attention" : "More Issues"}</h1><p>${index === 0 ? "Your top 3 priority fixes" : "Additional issues worth fixing next"}</p></div><section class="issue-stack">${pageIssues.length ? pageIssues.map((item) => issueCardHtml(item)).join("") : '<div class="card issue-empty"><p>No urgent issues need attention right now.</p></div>'}</section></div>`
    })),
    {
      content: `<div class="page-section"><div class="section-heading"><h1>Your 30-Day Plan</h1><p>Simple steps to improve your site</p></div><section class="plan-grid">${planBoxes}</section><section class="card outcome-card"><h2>Expected Outcome</h2><div class="outcome-metrics"><p>Current score: <strong>${score}/100</strong></p><p>After 30 days: <strong>${escapeHtml(narrative.overview.projected_score_range)}/100</strong></p></div><p>${escapeHtml(truncateText(narrative.overview.projected_summary, 170))}</p></section></div>`
    },
    {
      content: `<div class="page-section"><div class="section-heading"><h1>Google's Health Checks</h1><p>What Google measures on your site</p></div><section class="vitals-grid">${vitals}</section><section class="card vitals-summary-card"><p>${escapeHtml(truncateText(`${narrative.overview.vitals_intro} ${narrative.overview.vitals_overall}`, 180))}</p></section></div>`
    },
    {
      content: `<div class="page-section"><div class="section-heading"><h1>Works on All Devices?</h1><p>60% of visitors use phones</p></div><section class="device-grid">${deviceCardHtml("&#128241;", "Mobile", mobileScore, truncateText(narrative.overview.mobile_summary, 85))}${deviceCardHtml("&#128187;", "Desktop", desktopScore, truncateText(narrative.overview.desktop_summary, 85))}</section><section class="card device-summary-card"><p>${escapeHtml(truncateText(narrative.overview.device_tip, 140))}</p></section></div>`
    },
    {
      dark: true,
      content: `<div class="contact-page">${footerContactLogo}<h1>Thank you for choosing ${escapeHtml(name)}</h1><div class="contact-divider"></div><p class="contact-question">Questions about this report?</p><a class="contact-email" href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a><div class="contact-divider"></div><p class="contact-question">Your next report will be delivered:</p><p class="contact-next-date">${escapeHtml(nextDate)}</p><div class="contact-divider"></div><p class="contact-note">Report generated by ${escapeHtml(name)} using SitePulse monitoring</p></div>`
    }
  ];

  const totalPages = pages.length;
  const css = `
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; font-family: Inter, Manrope, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #0f172a; background: #ffffff; }
    .page { width: 210mm; min-height: 297mm; padding: 20mm; page-break-after: always; display: flex; flex-direction: column; overflow: hidden; }
    .page:last-child { page-break-after: auto; }
    .page--dark { background: ${NAVY}; color: #f8fafc; }
    .page-content { display: flex; flex: 1; flex-direction: column; gap: 16px; min-width: 0; }
    .page-section, .card, .issue-card, .score-card, .plan-box, .vitals-card, .device-card { min-width: 0; overflow: hidden; word-wrap: break-word; overflow-wrap: break-word; break-inside: avoid; }
    .card { padding: 24px; border-radius: 20px; border: 1px solid rgba(148,163,184,0.24); background: #ffffff; box-shadow: 0 14px 38px rgba(15,23,42,0.06); }
    .card p, .card span, .card h1, .card h2, .card h3 { max-width: 100%; }
    .section-heading { margin-bottom: 8px; }
    .section-heading h1 { margin: 0; font-size: 24px; line-height: 1.2; color: ${BLUE}; }
    .section-heading p { margin: 8px 0 0; font-size: 13px; color: #64748b; }
    .page-footer { margin-top: auto; padding-top: 12px; border-top: 1px solid rgba(148,163,184,0.25); display: flex; align-items: center; justify-content: space-between; gap: 16px; font-size: 11px; color: #64748b; }
    .page-footer--dark { color: rgba(241,245,249,0.82); border-top-color: rgba(255,255,255,0.12); }
    .page-footer__left, .page-footer__right { display: flex; align-items: center; gap: 10px; min-width: 0; }
    .page-footer__right { margin-left: auto; }
    .footer-logo, .contact-logo, .cover-logo { display: block; object-fit: contain; }
    .footer-logo { width: 22px; height: 22px; }
    .contact-logo, .cover-logo { width: 90px; height: 90px; }
    .footer-logo--white, .contact-logo--white, .cover-logo--white { filter: brightness(0) invert(1); }
    .footer-wordmark, .contact-wordmark, .cover-wordmark { font-weight: 700; letter-spacing: 0.02em; }
    .cover-page, .contact-page { display: flex; flex: 1; flex-direction: column; align-items: center; text-align: center; min-width: 0; }
    .cover-top { display: flex; flex-direction: column; align-items: center; gap: 20px; margin-top: 6mm; }
    .cover-agency { margin: 0; font-size: 18px; letter-spacing: 0.04em; color: #f8fafc; }
    .cover-middle { margin: auto 0; }
    .cover-kicker { margin: 0 0 12px; color: #f8fafc; font-size: 28px; font-weight: 300; }
    .cover-url { margin: 0; font-size: 18px; color: ${BLUE}; font-weight: 700; line-height: 1.4; word-break: break-word; }
    .cover-date { margin: 12px 0 0; color: #94a3b8; font-size: 14px; }
    .cover-bottom-card { width: 100%; background: rgba(255,255,255,0.96); text-align: left; margin-top: auto; box-shadow: none; }
    .cover-bottom-card hr, .contact-divider { width: 100%; border: none; border-top: 1px solid rgba(148,163,184,0.28); margin: 18px 0; }
    .cover-meta-label { margin: 0; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: #64748b; }
    .cover-meta-value { margin: 6px 0 0; font-size: 16px; font-weight: 600; color: #0f172a; }
    .health-card { display: grid; gap: 18px; place-items: center; text-align: center; }
    .health-badge { display: inline-flex; align-items: center; justify-content: center; padding: 12px 22px; border-radius: 999px; border: 2px solid; font-size: 16px; font-weight: 800; letter-spacing: 0.08em; }
    .health-summary { margin: 0; font-size: 14px; line-height: 1.7; color: #334155; }
    .score-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 16px; }
    .score-card { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 12px; min-height: 198px; }
    .score-card__eyebrow { margin: 0; font-size: 12px; color: #64748b; letter-spacing: 0.04em; }
    .score-circle { width: 80px; height: 80px; border-radius: 50%; border: 6px solid currentColor; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 800; flex-shrink: 0; line-height: 1; background: #ffffff; }
    .score-card__status, .device-card__status { margin: 0; font-size: 13px; font-weight: 700; }
    .score-card__summary, .device-card__summary, .vitals-card__summary { margin: 0; font-size: 12px; line-height: 1.55; color: #475569; }
    .changes-card h2, .comparison-card h2, .outcome-card h2 { margin: 0 0 14px; font-size: 16px; }
    .changes-row { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; font-size: 13px; color: #334155; }
    .changes-separator { color: #94a3b8; }
    .comparison-row { display: grid; grid-template-columns: 56px minmax(0,1fr) 28px; align-items: center; gap: 12px; font-size: 13px; color: #334155; }
    .comparison-row + .comparison-row { margin-top: 12px; }
    .progress-track { height: 10px; border-radius: 999px; background: #e2e8f0; overflow: hidden; }
    .progress-fill { height: 100%; border-radius: inherit; }
    .issue-stack { display: grid; gap: 16px; }
    .issue-card { height: 200px; display: grid; grid-template-rows: auto auto auto auto auto 1fr auto; gap: 8px; }
    .issue-card__priority { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 800; letter-spacing: 0.08em; }
    .issue-card__title { margin: 0; font-size: 18px; line-height: 1.2; min-height: 44px; }
    .issue-card__label { margin: 0 0 3px; font-size: 11px; font-weight: 700; color: #0f172a; }
    .issue-card__copy { margin: 0; font-size: 12px; line-height: 1.5; color: #475569; overflow: hidden; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
    .issue-card__section--compact .issue-card__copy { -webkit-line-clamp: 1; }
    .issue-card__meta { display: flex; flex-wrap: wrap; gap: 10px 18px; margin-top: auto; font-size: 11px; color: #334155; }
    .issue-empty { min-height: 120px; display: grid; place-items: center; text-align: center; }
    .plan-grid { display: grid; gap: 16px; }
    .plan-box h3 { margin: 0; font-size: 18px; }
    .plan-box__header p { margin: 8px 0 0; font-size: 13px; color: #64748b; }
    .plan-box__tasks { display: grid; gap: 14px; margin-top: 18px; }
    .plan-task { display: grid; grid-template-columns: 18px minmax(0,1fr); gap: 10px; align-items: start; }
    .plan-task__checkbox { font-size: 18px; line-height: 1; color: ${BLUE}; }
    .plan-task__title, .plan-task__time { margin: 0; font-size: 13px; line-height: 1.45; }
    .plan-task__time { margin-top: 4px; color: #64748b; }
    .outcome-card { background: #eff6ff; border-color: rgba(59,130,246,0.24); }
    .outcome-card p { margin: 0; font-size: 14px; line-height: 1.6; }
    .outcome-metrics { display: grid; gap: 8px; margin-bottom: 12px; }
    .vitals-grid { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 16px; }
    .vitals-card { min-height: 194px; text-align: center; display: flex; flex-direction: column; gap: 12px; align-items: center; }
    .vitals-card__title { margin: 0; font-size: 14px; font-weight: 700; }
    .vitals-card__value { margin: 0; font-size: 28px; font-weight: 800; color: #0f172a; }
    .vitals-card__status { margin: 0; font-size: 13px; font-weight: 700; }
    .vitals-summary-card, .device-summary-card { background: #eff6ff; border-color: rgba(59,130,246,0.24); }
    .vitals-summary-card p, .device-summary-card p { margin: 0; font-size: 14px; line-height: 1.65; color: #1e3a8a; }
    .device-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 16px; }
    .device-card { min-height: 240px; display: flex; flex-direction: column; align-items: center; gap: 12px; text-align: center; }
    .device-card__title { margin: 0; font-size: 16px; font-weight: 700; }
    .contact-page { justify-content: center; gap: 18px; }
    .contact-page h1 { margin: 0; font-size: 28px; line-height: 1.25; color: #f8fafc; }
    .contact-question { margin: 0; font-size: 16px; color: #cbd5e1; }
    .contact-email { color: ${BLUE}; font-size: 26px; font-weight: 700; text-decoration: none; word-break: break-word; }
    .contact-next-date { margin: 0; font-size: 28px; font-weight: 700; color: ${BLUE}; }
    .contact-note { margin: 0; font-size: 12px; color: #cbd5e1; }
  `;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><style>${css}</style></head><body>${pages.map((page, index) => `<section class="page ${page.dark ? "page--dark" : ""}"><div class="page-content">${page.content}</div>${footerHtml(index + 1, totalPages, name, email, logo, page.dark)}</section>`).join("")}</body></html>`;
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
