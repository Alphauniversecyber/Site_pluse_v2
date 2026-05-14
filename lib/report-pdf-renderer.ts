import "server-only";

import { jsPDF } from "jspdf";

import type {
  AgencyBranding,
  ScanResult,
  ScanSchedule,
  UserProfile,
  Website
} from "@/types";
import {
  buildReportNarrative,
  type ReportIssueGroup,
  type ReportRecommendationGroup
} from "@/lib/report-ai";
import { getNextReportDate as getScheduledNextReportDate } from "@/lib/report-cadence";
import { formatDateTime } from "@/lib/utils";

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 42;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const INDUSTRY_AVERAGE_SCORE = 78;
type PdfDoc = InstanceType<typeof jsPDF>;

type PdfContext = {
  website: Website;
  scan: ScanResult;
  previousScan: ScanResult | null;
  history: ScanResult[];
  branding?: AgencyBranding | null;
  profile: UserProfile;
  schedule?: ScanSchedule | null;
};

function hexToRgb(hex: string) {
  const clean = hex.replace("#", "");
  const normalized =
    clean.length === 3 ? clean.split("").map((char) => `${char}${char}`).join("") : clean;
  const value = Number.parseInt(normalized, 16);

  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255
  };
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

function splitLines(doc: PdfDoc, text: string, width: number) {
  return doc.splitTextToSize(text, width) as string[];
}

function estimateTextHeight(doc: PdfDoc, text: string, width: number, lineHeight: number) {
  return splitLines(doc, text, width).length * lineHeight;
}

function truncateSingleLine(doc: PdfDoc, text: string, maxWidth: number, fontSize: number) {
  doc.setFontSize(fontSize);

  if (doc.getTextWidth(text) <= maxWidth) {
    return text;
  }

  let truncated = text;
  while (truncated.length > 0 && doc.getTextWidth(`${truncated}…`) > maxWidth) {
    truncated = truncated.slice(0, -1);
  }

  return `${truncated.trim()}…`;
}

function drawMultilineText(input: {
  doc: PdfDoc;
  text: string;
  x: number;
  y: number;
  width: number;
  fontSize: number;
  lineHeight: number;
  color?: [number, number, number];
  fontStyle?: "normal" | "bold";
}) {
  const lines = splitLines(input.doc, input.text, input.width);
  input.doc.setFont("helvetica", input.fontStyle ?? "normal");
  input.doc.setFontSize(input.fontSize);
  if (input.color) {
    input.doc.setTextColor(...input.color);
  }
  input.doc.text(lines, input.x, input.y);
  return input.y + lines.length * input.lineHeight;
}

function drawRoundedCard(
  doc: PdfDoc,
  x: number,
  y: number,
  width: number,
  height: number,
  fill: [number, number, number],
  stroke: [number, number, number] = [226, 232, 240]
) {
  doc.setFillColor(...fill);
  doc.setDrawColor(...stroke);
  doc.roundedRect(x, y, width, height, 18, 18, "FD");
}

function getBrandName(input: PdfContext) {
  return input.branding?.agency_name || input.branding?.email_from_name || input.profile.full_name || "Your Agency";
}

function getReplyToEmail(input: PdfContext) {
  return input.branding?.reply_to_email?.trim() || input.profile.email || "your agency";
}

function getAgencyWebsite(input: PdfContext) {
  return input.branding?.agency_website_url?.trim() || "";
}

function getReportFooterNote(input: PdfContext) {
  return input.branding?.report_footer_text?.trim() || "";
}

function getNextReportDate(input: PdfContext) {
  return getScheduledNextReportDate(input.scan.scanned_at, input.website.report_frequency);
}

function getOverallScore(scan: ScanResult) {
  return Math.round(
    (scan.performance_score + scan.seo_score + scan.accessibility_score + scan.best_practices_score) / 4
  );
}

function getTone(score: number) {
  if (score >= 90) {
    return {
      fill: [34, 197, 94] as [number, number, number],
      soft: [220, 252, 231] as [number, number, number],
      label: "Excellent"
    };
  }

  if (score >= 75) {
    return {
      fill: [245, 158, 11] as [number, number, number],
      soft: [254, 243, 199] as [number, number, number],
      label: "Good"
    };
  }

  return {
    fill: [239, 68, 68] as [number, number, number],
    soft: [254, 226, 226] as [number, number, number],
    label: "Needs attention"
  };
}

function drawPageChrome(input: {
  doc: PdfDoc;
  title: string;
  subtitle?: string;
  brandColor: { r: number; g: number; b: number };
}) {
  const { doc } = input;

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, PAGE_WIDTH, 96, "F");
  doc.setFillColor(input.brandColor.r, input.brandColor.g, input.brandColor.b);
  doc.rect(0, 0, PAGE_WIDTH, 8, "F");

  doc.setTextColor(248, 250, 252);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.text(input.title, MARGIN, 48);

  if (input.subtitle) {
    drawMultilineText({
      doc,
      text: input.subtitle,
      x: MARGIN,
      y: 68,
      width: CONTENT_WIDTH,
      fontSize: 11,
      lineHeight: 14,
      color: [191, 219, 254]
    });
  }
}

function drawPageFooter(input: {
  doc: PdfDoc;
  agencyName: string;
  agencyWebsite?: string;
  pageNumber: number;
  totalPages: number;
  darkPage?: boolean;
}) {
  const color = input.darkPage ? [100, 116, 139] : [148, 163, 184];
  const border = input.darkPage ? [30, 41, 59] : [226, 232, 240];
  const footerY = PAGE_HEIGHT - 24;

  input.doc.setDrawColor(...border);
  input.doc.setLineWidth(1);
  input.doc.line(MARGIN, footerY - 14, PAGE_WIDTH - MARGIN, footerY - 14);

  input.doc.setFont("helvetica", "normal");
  input.doc.setFontSize(10);
  input.doc.setTextColor(...color);
  input.doc.text(input.agencyName, MARGIN, footerY);

  if (input.agencyWebsite) {
    input.doc.text(input.agencyWebsite, PAGE_WIDTH / 2, footerY, {
      align: "center",
      maxWidth: 220
    });
  }

  input.doc.text(`Page ${input.pageNumber} of ${input.totalPages}`, PAGE_WIDTH - MARGIN, footerY, {
    align: "right"
  });
}

function applyPageFooters(input: {
  doc: PdfDoc;
  agencyName: string;
  agencyWebsite?: string;
}) {
  const totalPages = input.doc.getNumberOfPages();

  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
    input.doc.setPage(pageNumber);
    drawPageFooter({
      doc: input.doc,
      agencyName: input.agencyName,
      agencyWebsite: input.agencyWebsite,
      pageNumber,
      totalPages,
      darkPage: pageNumber === totalPages
    });
  }
}

function drawPill(
  doc: PdfDoc,
  text: string,
  x: number,
  y: number,
  fill: [number, number, number],
  textColor: [number, number, number] = [255, 255, 255],
  maxWidth?: number,
  fontSize = 10
) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(fontSize);
  const safeText = maxWidth ? truncateSingleLine(doc, text, Math.max(32, maxWidth - 24), fontSize) : text;
  const width = Math.min(maxWidth ?? Number.POSITIVE_INFINITY, Math.max(78, doc.getTextWidth(safeText) + 24));
  doc.setFillColor(...fill);
  doc.roundedRect(x, y, width, 24, 12, 12, "F");
  doc.setTextColor(...textColor);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(fontSize);
  doc.text(safeText, x + width / 2, y + 16, { align: "center" });
  return width;
}

function drawProgressBar(input: {
  doc: PdfDoc;
  x: number;
  y: number;
  width: number;
  value: number;
  benchmark: number;
  brandColor: { r: number; g: number; b: number };
}) {
  const { doc } = input;
  doc.setFillColor(226, 232, 240);
  doc.roundedRect(input.x, input.y, input.width, 10, 5, 5, "F");
  doc.setFillColor(input.brandColor.r, input.brandColor.g, input.brandColor.b);
  doc.roundedRect(input.x, input.y, (input.width * Math.min(100, input.value)) / 100, 10, 5, 5, "F");
  doc.setDrawColor(148, 163, 184);
  const benchmarkX = input.x + (input.width * Math.min(100, input.benchmark)) / 100;
  doc.line(benchmarkX, input.y - 4, benchmarkX, input.y + 14);
}

function drawScoreCircleCard(input: {
  doc: PdfDoc;
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  score: number;
  label: string;
  summary: string;
}) {
  const { doc } = input;
  const tone = getTone(input.score);
  drawRoundedCard(doc, input.x, input.y, input.width, input.height, [255, 255, 255]);

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(input.title, input.x + 16, input.y + 22);

  doc.setDrawColor(...tone.fill);
  doc.setLineWidth(4);
  doc.circle(input.x + input.width / 2, input.y + 54, 20);
  doc.setFontSize(14);
  doc.text(String(input.score), input.x + input.width / 2, input.y + 58, { align: "center" });

  drawPill(doc, input.label, input.x + 16, input.y + 82, tone.fill, [255, 255, 255], input.width - 32, 8.5);
  drawMultilineText({
    doc,
    text: input.summary,
    x: input.x + 16,
    y: input.y + 118,
    width: input.width - 32,
    fontSize: 9,
    lineHeight: 13,
    color: [71, 85, 105]
  });
}

function drawHeaderPanel(input: {
  doc: PdfDoc;
  y: number;
  website: Website;
  scan: ScanResult;
  branding?: AgencyBranding | null;
  brandName: string;
  logoDataUrl: string | null;
}) {
  const { doc } = input;
  const getLogoLayout = (logoSource: string) => {
    const image = doc.getImageProperties(logoSource);
    const maxWidth = 130;
    const maxHeight = 42;
    const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
    return {
      width: image.width * scale,
      height: image.height * scale,
      imageType: typeof image.fileType === "string" ? image.fileType.toUpperCase() : "PNG"
    };
  };
  const panelY = input.y;
  const rightColumnX = MARGIN + 190;
  const rightColumnWidth = CONTENT_WIDTH - 210;
  const preparedForLines = splitLines(doc, `Prepared for: ${input.website.label}`, rightColumnWidth);
  const preparedByLines = splitLines(doc, `Prepared by: ${input.brandName}`, rightColumnWidth);
  const urlLines = splitLines(doc, `Website URL: ${input.website.url}`, CONTENT_WIDTH - 170);
  const panelHeight = Math.max(
    122,
    84 + preparedForLines.length * 16 + preparedByLines.length * 16 + Math.max(18, urlLines.length * 14)
  );

  drawRoundedCard(doc, MARGIN, panelY, CONTENT_WIDTH, panelHeight, [255, 255, 255]);

  if (input.logoDataUrl) {
    try {
      const logoLayout = getLogoLayout(input.logoDataUrl);
      doc.addImage(input.logoDataUrl, logoLayout.imageType, MARGIN + 20, panelY + 20, logoLayout.width, logoLayout.height);
    } catch {
      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.text(input.brandName, MARGIN + 20, panelY + 44);
    }
  } else {
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text(input.brandName, MARGIN + 20, panelY + 44);
  }

  let textY = panelY + 34;
  textY = drawMultilineText({
    doc,
    text: `Prepared for: ${input.website.label}`,
    x: rightColumnX,
    y: textY,
    width: rightColumnWidth,
    fontSize: 13,
    lineHeight: 16,
    color: [15, 23, 42],
    fontStyle: "bold"
  });
  textY += 8;
  drawMultilineText({
    doc,
    text: `Prepared by: ${input.brandName}`,
    x: rightColumnX,
    y: textY,
    width: rightColumnWidth,
    fontSize: 13,
    lineHeight: 16,
    color: [15, 23, 42],
    fontStyle: "bold"
  });

  drawMultilineText({
    doc,
    text: `Website URL: ${input.website.url}`,
    x: MARGIN + 20,
    y: panelY + panelHeight - 24 - Math.max(0, (urlLines.length - 1) * 14),
    width: CONTENT_WIDTH - 180,
    fontSize: 11,
    lineHeight: 14,
    color: [71, 85, 105]
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(71, 85, 105);
  doc.text(`Scan date: ${formatDateTime(input.scan.scanned_at)}`, PAGE_WIDTH - MARGIN - 20, panelY + panelHeight - 10, {
    align: "right"
  });

  return panelY + panelHeight;
}

function drawExecutiveSummary(input: {
  doc: PdfDoc;
  y: number;
  brandColor: { r: number; g: number; b: number };
  overallHealth: string;
  executiveLines: string[];
}) {
  const healthTone =
    input.overallHealth === "GOOD"
      ? ([34, 197, 94] as [number, number, number])
      : input.overallHealth === "NEEDS ATTENTION"
        ? ([245, 158, 11] as [number, number, number])
        : ([239, 68, 68] as [number, number, number]);

  const copy = input.executiveLines.join(" ");
  const summaryHeight = estimateTextHeight(input.doc, copy, CONTENT_WIDTH - 40, 18);
  const cardHeight = Math.max(118, 82 + summaryHeight);
  drawRoundedCard(input.doc, MARGIN, input.y, CONTENT_WIDTH, cardHeight, [255, 255, 255]);
  input.doc.setTextColor(15, 23, 42);
  input.doc.setFont("helvetica", "bold");
  input.doc.setFontSize(14);
  input.doc.text("Overall Website Health", MARGIN + 20, input.y + 26);
  drawPill(input.doc, input.overallHealth, MARGIN + 20, input.y + 36, healthTone);
  drawMultilineText({
    doc: input.doc,
    text: copy,
    x: MARGIN + 20,
    y: input.y + 78,
    width: CONTENT_WIDTH - 40,
    fontSize: 12,
    lineHeight: 18,
    color: [51, 65, 85]
  });
  return input.y + cardHeight;
}

function drawScoreSummarySection(input: {
  doc: PdfDoc;
  y: number;
  scan: ScanResult;
  overview: Awaited<ReturnType<typeof buildReportNarrative>>["overview"];
  brandColor: { r: number; g: number; b: number };
  previousScan: ScanResult | null;
}) {
  const cardWidth = (CONTENT_WIDTH - 36) / 4;
  const items = [
    {
      title: "Performance",
      score: input.scan.performance_score,
      label: input.overview.score_summaries.performance.label,
      summary: input.overview.score_summaries.performance.summary
    },
    {
      title: "SEO",
      score: input.scan.seo_score,
      label: input.overview.score_summaries.seo.label,
      summary: input.overview.score_summaries.seo.summary
    },
    {
      title: "Accessibility",
      score: input.scan.accessibility_score,
      label: input.overview.score_summaries.accessibility.label,
      summary: input.overview.score_summaries.accessibility.summary
    },
    {
      title: "Best Practices",
      score: input.scan.best_practices_score,
      label: input.overview.score_summaries.best_practices.label,
      summary: input.overview.score_summaries.best_practices.summary
    }
  ] as const;

  const summaryHeights = items.map((item) =>
    estimateTextHeight(input.doc, item.summary, cardWidth - 32, 13)
  );
  const cardHeight = Math.max(164, 122 + Math.max(...summaryHeights, 0));

  items.forEach((item, index) => {
    drawScoreCircleCard({
      doc: input.doc,
      x: MARGIN + index * (cardWidth + 12),
      y: input.y,
      width: cardWidth,
      height: cardHeight,
      ...item
    });
  });

  const deltaY = input.y + cardHeight + 18;
  const changeText = input.overview.changes_summary;
  const changeSummaryHeight = estimateTextHeight(input.doc, changeText, CONTENT_WIDTH - 40, 15);
  const deltaHeight = Math.max(92, 62 + changeSummaryHeight);
  drawRoundedCard(input.doc, MARGIN, deltaY, CONTENT_WIDTH, deltaHeight, [255, 255, 255]);
  input.doc.setTextColor(15, 23, 42);
  input.doc.setFont("helvetica", "bold");
  input.doc.setFontSize(13);
  input.doc.text("Compared to the last scan", MARGIN + 20, deltaY + 24);

  const performanceDelta = input.previousScan
    ? input.scan.performance_score - input.previousScan.performance_score
    : 0;
  const seoDelta = input.previousScan ? input.scan.seo_score - input.previousScan.seo_score : 0;
  const accessDelta = input.previousScan
    ? input.scan.accessibility_score - input.previousScan.accessibility_score
    : 0;

  input.doc.setFont("helvetica", "normal");
  input.doc.setFontSize(11);
  input.doc.setTextColor(71, 85, 105);
  input.doc.text(
    `Performance ${performanceDelta >= 0 ? "+" : ""}${performanceDelta}   |   SEO ${seoDelta >= 0 ? "+" : ""}${seoDelta}   |   Accessibility ${accessDelta >= 0 ? "+" : ""}${accessDelta}`,
    MARGIN + 20,
    deltaY + 46
  );
  drawMultilineText({
    doc: input.doc,
    text: changeText,
    x: MARGIN + 20,
    y: deltaY + 64,
    width: CONTENT_WIDTH - 40,
    fontSize: 11,
    lineHeight: 15,
    color: [71, 85, 105]
  });

  const progressY = deltaY + deltaHeight + 14;
  const progressHeight = 84;
  drawRoundedCard(input.doc, MARGIN, progressY, CONTENT_WIDTH, progressHeight, [255, 255, 255]);
  input.doc.setTextColor(15, 23, 42);
  input.doc.setFont("helvetica", "bold");
  input.doc.setFontSize(13);
  input.doc.text("Score vs industry average", MARGIN + 20, progressY + 24);
  input.doc.setFont("helvetica", "normal");
  input.doc.setFontSize(11);
  input.doc.setTextColor(71, 85, 105);
  input.doc.text(
    `Your website: ${getOverallScore(input.scan)} / Industry average: ${INDUSTRY_AVERAGE_SCORE}`,
    MARGIN + 20,
    progressY + 42
  );
  drawProgressBar({
    doc: input.doc,
    x: MARGIN + 20,
    y: progressY + 52,
    width: CONTENT_WIDTH - 40,
    value: getOverallScore(input.scan),
    benchmark: INDUSTRY_AVERAGE_SCORE,
    brandColor: input.brandColor
  });

  return progressY + progressHeight;
}

function drawIssueCard(input: {
  doc: PdfDoc;
  x: number;
  y: number;
  width: number;
  issue: ReportIssueGroup["issues"][number];
  color: string;
}) {
  const color = hexToRgb(input.color);
  const bodyWidth = input.width - 36;
  const lineHeight = 14;
  const titleHeight = estimateTextHeight(input.doc, input.issue.ai.title, bodyWidth, 16);
  const metaText = [
    input.issue.insight.relatedIssues.length > 1
      ? `${input.issue.insight.relatedIssues.length} related findings`
      : "Single finding",
    input.issue.insight.device === "both"
      ? "Mobile and desktop"
      : input.issue.insight.device === "mobile"
        ? "Mobile"
        : input.issue.insight.device === "desktop"
          ? "Desktop"
          : null
  ]
    .filter(Boolean)
    .join(" | ");
  const metaHeight = metaText ? 13 : 0;
  const textHeights =
    estimateTextHeight(input.doc, `What's happening: ${input.issue.ai.what_is_happening}`, bodyWidth, lineHeight) +
    estimateTextHeight(input.doc, `Why it matters: ${input.issue.ai.why_it_matters}`, bodyWidth, lineHeight) +
    estimateTextHeight(input.doc, `Root cause: ${input.issue.ai.root_cause}`, bodyWidth, lineHeight);
  const height = Math.max(178, 82 + titleHeight + metaHeight + textHeights);

  drawRoundedCard(input.doc, input.x, input.y, input.width, height, [255, 255, 255]);
  drawPill(input.doc, input.issue.insight.priority, input.x + 18, input.y + 16, [
    color.r,
    color.g,
    color.b
  ], [255, 255, 255], 108);

  input.doc.setFont("helvetica", "bold");
  input.doc.setFontSize(14);
  input.doc.setTextColor(15, 23, 42);
  const titleLines = splitLines(input.doc, input.issue.ai.title, bodyWidth);
  input.doc.text(titleLines, input.x + 18, input.y + 52, {
    maxWidth: bodyWidth
  });

  let cursorY = input.y + 52 + titleLines.length * 16 + 2;
  if (metaText) {
    input.doc.setFont("helvetica", "normal");
    input.doc.setFontSize(10);
    input.doc.setTextColor(100, 116, 139);
    input.doc.text(metaText, input.x + 18, cursorY);
    cursorY += 18;
  }
  cursorY = drawMultilineText({
    doc: input.doc,
    text: `What's happening: ${input.issue.ai.what_is_happening}`,
    x: input.x + 18,
    y: cursorY,
    width: bodyWidth,
    fontSize: 10.5,
    lineHeight,
    color: [51, 65, 85]
  });
  cursorY += 6;
  cursorY = drawMultilineText({
    doc: input.doc,
    text: `Why it matters: ${input.issue.ai.why_it_matters}`,
    x: input.x + 18,
    y: cursorY,
    width: bodyWidth,
    fontSize: 10.5,
    lineHeight,
    color: [51, 65, 85]
  });
  cursorY += 6;
  cursorY = drawMultilineText({
    doc: input.doc,
    text: `Root cause: ${input.issue.ai.root_cause}`,
    x: input.x + 18,
    y: cursorY,
    width: bodyWidth,
    fontSize: 10.5,
    lineHeight,
    color: [51, 65, 85]
  });
  return height;
}

function measureIssueCardHeight(doc: PdfDoc, width: number, issue: ReportIssueGroup["issues"][number]) {
  const bodyWidth = width - 36;
  const lineHeight = 14;
  const titleHeight = estimateTextHeight(doc, issue.ai.title, bodyWidth, 16);
  const metaText = [
    issue.insight.relatedIssues.length > 1 ? `${issue.insight.relatedIssues.length} related findings` : "Single finding",
    issue.insight.device === "both"
      ? "Mobile and desktop"
      : issue.insight.device === "mobile"
        ? "Mobile"
        : issue.insight.device === "desktop"
          ? "Desktop"
          : null
  ]
    .filter(Boolean)
    .join(" | ");
  const metaHeight = metaText ? 13 : 0;
  const textHeights =
    estimateTextHeight(doc, `What's happening: ${issue.ai.what_is_happening}`, bodyWidth, lineHeight) +
    estimateTextHeight(doc, `Why it matters: ${issue.ai.why_it_matters}`, bodyWidth, lineHeight) +
    estimateTextHeight(doc, `Root cause: ${issue.ai.root_cause}`, bodyWidth, lineHeight);

  return Math.max(178, 82 + titleHeight + metaHeight + textHeights);
}

function drawRecommendationCard(input: {
  doc: PdfDoc;
  x: number;
  y: number;
  width: number;
  recommendation: ReportRecommendationGroup["recommendations"][number];
  color: string;
}) {
  const color = hexToRgb(input.color);
  const bodyWidth = input.width - 36;
  const lineHeight = 14;
  const titleHeight = estimateTextHeight(input.doc, input.recommendation.ai.title, bodyWidth - 120, 16);
  const actionHeight = estimateTextHeight(
    input.doc,
    `Action: ${input.recommendation.ai.action}`,
    bodyWidth,
    lineHeight
  );
  const impactHeight = estimateTextHeight(
    input.doc,
    `Expected impact: ${input.recommendation.ai.expected_impact}`,
    bodyWidth,
    lineHeight
  );
  const height = Math.max(174, 92 + titleHeight + actionHeight + impactHeight);

  drawRoundedCard(input.doc, input.x, input.y, input.width, height, [255, 255, 255]);
  drawPill(input.doc, input.recommendation.ai.priority, input.x + 18, input.y + 16, [
    color.r,
    color.g,
    color.b
  ], [255, 255, 255], 112);
  drawPill(input.doc, input.recommendation.ai.effort, input.x + input.width - 106, input.y + 16, [
    15,
    23,
    42
  ], [255, 255, 255], 88);

  input.doc.setFont("helvetica", "bold");
  input.doc.setFontSize(14);
  input.doc.setTextColor(15, 23, 42);
  const titleLines = splitLines(input.doc, input.recommendation.ai.title, bodyWidth);
  input.doc.text(titleLines, input.x + 18, input.y + 56, {
    maxWidth: bodyWidth
  });

  let cursorY = input.y + 56 + titleLines.length * 16 + 8;
  cursorY = drawMultilineText({
    doc: input.doc,
    text: `Action: ${input.recommendation.ai.action}`,
    x: input.x + 18,
    y: cursorY,
    width: bodyWidth,
    fontSize: 10.5,
    lineHeight,
    color: [51, 65, 85]
  });
  cursorY += 8;
  drawMultilineText({
    doc: input.doc,
    text: `Expected impact: ${input.recommendation.ai.expected_impact}`,
    x: input.x + 18,
    y: cursorY,
    width: bodyWidth,
    fontSize: 10.5,
    lineHeight,
    color: [51, 65, 85]
  });

  return height;
}

function measureRecommendationCardHeight(
  doc: PdfDoc,
  width: number,
  recommendation: ReportRecommendationGroup["recommendations"][number]
) {
  const bodyWidth = width - 36;
  const lineHeight = 14;
  const titleHeight = estimateTextHeight(doc, recommendation.ai.title, bodyWidth - 120, 16);
  const actionHeight = estimateTextHeight(doc, `Action: ${recommendation.ai.action}`, bodyWidth, lineHeight);
  const impactHeight = estimateTextHeight(
    doc,
    `Expected impact: ${recommendation.ai.expected_impact}`,
    bodyWidth,
    lineHeight
  );

  return Math.max(174, 92 + titleHeight + actionHeight + impactHeight);
}

export async function renderAiReportPdf(input: PdfContext) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const brandColor = hexToRgb(input.branding?.brand_color || "#3B82F6");
  const brandName = getBrandName(input);
  const footerWebsite = getAgencyWebsite(input);
  const footerNote = getReportFooterNote(input);
  const replyToEmail = getReplyToEmail(input);
  const nextReportDate = getNextReportDate(input);
  const logoDataUrl = input.branding?.logo_url
    ? await fetchImageAsDataUrl(input.branding.logo_url).catch(() => null)
    : null;
  const narrative = await buildReportNarrative({
    website: input.website,
    scan: input.scan,
    previousScan: input.previousScan,
    branding: input.branding ?? null,
    profile: input.profile
  });

  drawPageChrome({
    doc,
    title: "Executive Summary",
    subtitle: `${input.website.url} • Prepared by ${brandName}`,
    brandColor
  });
  let cursorY =
    drawHeaderPanel({
      doc,
      y: 116,
      website: input.website,
      scan: input.scan,
      branding: input.branding ?? null,
      brandName,
      logoDataUrl
    }) + 18;
  cursorY =
    drawExecutiveSummary({
      doc,
      y: cursorY,
      brandColor,
      overallHealth: narrative.overview.overall_health,
      executiveLines: narrative.overview.executive_sentences
    }) + 18;
  drawScoreSummarySection({
    doc,
    y: cursorY,
    scan: input.scan,
    overview: narrative.overview,
    brandColor,
    previousScan: input.previousScan
  });

  const startNewPage = (title: string, subtitle?: string) => {
    doc.addPage();
    drawPageChrome({
      doc,
      title,
      subtitle,
      brandColor
    });
  };

  startNewPage("Issues Found", "Grouped and prioritized so your client sees the real root problems first");

  cursorY = 120;
  const issueCardWidth = CONTENT_WIDTH;
  if (!narrative.groupedIssues.length) {
    drawRoundedCard(doc, MARGIN, cursorY, issueCardWidth, 94, [255, 255, 255]);
    drawMultilineText({
      doc,
      text: "No major issues were found in this scan. Your website is in a healthy position right now.",
      x: MARGIN + 20,
      y: cursorY + 34,
      width: issueCardWidth - 40,
      fontSize: 12,
      lineHeight: 18,
      color: [51, 65, 85]
    });
  } else {
    for (const group of narrative.groupedIssues) {
      if (cursorY > PAGE_HEIGHT - 140) {
        startNewPage("Issues Found", "Continued");
        cursorY = 120;
      }

      const groupColor = hexToRgb(group.color);
      drawPill(doc, group.title, MARGIN, cursorY, [
        groupColor.r,
        groupColor.g,
        groupColor.b
      ]);
      cursorY += 36;

      for (const issue of group.issues) {
        const estimatedHeight = measureIssueCardHeight(doc, issueCardWidth, issue);

        if (cursorY + estimatedHeight > PAGE_HEIGHT - 60) {
          startNewPage("Issues Found", `${group.title} continued`);
          cursorY = 120;
        }

        const height = drawIssueCard({
          doc,
          x: MARGIN,
          y: cursorY,
          width: issueCardWidth,
          issue,
          color: group.color
        });
        cursorY += height + 14;
      }

      cursorY += 8;
    }
  }

  startNewPage("Recommendations", "Clear next steps mapped directly from the grouped issues above");

  cursorY = 120;
  const recommendationCardWidth = CONTENT_WIDTH;
  if (!narrative.groupedRecommendations.length) {
    drawRoundedCard(doc, MARGIN, cursorY, recommendationCardWidth, 94, [255, 255, 255]);
    drawMultilineText({
      doc,
      text: "No major recommendations were needed for this scan. Your website is already in a healthy position.",
      x: MARGIN + 20,
      y: cursorY + 34,
      width: recommendationCardWidth - 40,
      fontSize: 12,
      lineHeight: 18,
      color: [51, 65, 85]
    });
  } else {
    for (const group of narrative.groupedRecommendations) {
      if (cursorY > PAGE_HEIGHT - 140) {
        startNewPage("Recommendations", "Continued");
        cursorY = 120;
      }

      const groupColor = hexToRgb(group.color);
      drawPill(doc, group.title, MARGIN, cursorY, [
        groupColor.r,
        groupColor.g,
        groupColor.b
      ]);
      cursorY += 36;

      for (const recommendation of group.recommendations) {
        const estimatedHeight = measureRecommendationCardHeight(doc, recommendationCardWidth, recommendation);

        if (cursorY + estimatedHeight > PAGE_HEIGHT - 60) {
          startNewPage("Recommendations", `${group.title} continued`);
          cursorY = 120;
        }

        const height = drawRecommendationCard({
          doc,
          x: MARGIN,
          y: cursorY,
          width: recommendationCardWidth,
          recommendation,
          color: group.color
        });
        cursorY += height + 14;
      }

      cursorY += 8;
    }
  }

  startNewPage(narrative.overview.action_plan_title, "A simple, prioritized plan for the next 30 days");

  cursorY = 124;
  const actionIntroHeight = Math.max(
    74,
    46 + estimateTextHeight(doc, narrative.overview.action_plan_intro, CONTENT_WIDTH - 40, 18)
  );
  drawRoundedCard(doc, MARGIN, cursorY, CONTENT_WIDTH, actionIntroHeight, [239, 246, 255], [191, 219, 254]);
  drawMultilineText({
    doc,
    text: narrative.overview.action_plan_intro,
    x: MARGIN + 20,
    y: cursorY + 28,
    width: CONTENT_WIDTH - 40,
    fontSize: 12,
    lineHeight: 18,
    color: [30, 64, 175],
    fontStyle: "bold"
  });

  cursorY += actionIntroHeight + 18;
  for (const week of narrative.overview.action_plan) {
    const expectedHeight = estimateTextHeight(doc, week.expected_result, CONTENT_WIDTH - 40, 16);
    const taskHeights = week.tasks.map((task) =>
      estimateTextHeight(doc, `${task.task} (${task.time})`, CONTENT_WIDTH - 80, 14)
    );
    const weekHeight = Math.max(
      136,
      64 + expectedHeight + taskHeights.reduce((sum, height) => sum + height + 8, 0) + 12
    );

    if (cursorY + weekHeight > PAGE_HEIGHT - 86) {
      startNewPage(narrative.overview.action_plan_title, "Continued");
      cursorY = 124;
    }

    drawRoundedCard(doc, MARGIN, cursorY, CONTENT_WIDTH, weekHeight, [255, 255, 255]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text(`${week.phase}: ${week.focus}`, MARGIN + 20, cursorY + 26);
    const summaryEndY = drawMultilineText({
      doc,
      text: week.expected_result,
      x: MARGIN + 20,
      y: cursorY + 46,
      width: CONTENT_WIDTH - 40,
      fontSize: 11,
      lineHeight: 16,
      color: [71, 85, 105]
    });

    let taskY = summaryEndY + 16;
    week.tasks.forEach((task) => {
      doc.rect(MARGIN + 20, taskY - 9, 10, 10);
      const taskHeight = estimateTextHeight(doc, `${task.task} (${task.time})`, CONTENT_WIDTH - 80, 14);
      drawMultilineText({
        doc,
        text: `${task.task} (${task.time})`,
        x: MARGIN + 38,
        y: taskY,
        width: CONTENT_WIDTH - 80,
        fontSize: 11,
        lineHeight: 14,
        color: [51, 65, 85]
      });
      taskY += taskHeight + 8;
    });

    cursorY += weekHeight + 16;
  }

  const projectedHeight = Math.max(
    84,
    46 + estimateTextHeight(doc, narrative.overview.projected_summary, CONTENT_WIDTH - 40, 16)
  );
  if (cursorY + projectedHeight > PAGE_HEIGHT - 60) {
    startNewPage(narrative.overview.action_plan_title, "Continued");
    cursorY = 124;
  }
  drawRoundedCard(doc, MARGIN, cursorY, CONTENT_WIDTH, projectedHeight, [15, 23, 42], [15, 23, 42]);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`Projected score range: ${narrative.overview.projected_score_range}`, MARGIN + 20, cursorY + 28);
  drawMultilineText({
    doc,
    text: narrative.overview.projected_summary,
    x: MARGIN + 20,
    y: cursorY + 50,
    width: CONTENT_WIDTH - 40,
    fontSize: 11,
    lineHeight: 16,
    color: [226, 232, 240]
  });

  startNewPage("Google's 3 Key Measurements", "What these scores mean for your business in plain English");

  cursorY = 124;
  const vitalsIntroHeight = Math.max(
    72,
    44 + estimateTextHeight(doc, narrative.overview.vitals_intro, CONTENT_WIDTH - 40, 18)
  );
  drawRoundedCard(doc, MARGIN, cursorY, CONTENT_WIDTH, vitalsIntroHeight, [239, 246, 255], [191, 219, 254]);
  drawMultilineText({
    doc,
    text: narrative.overview.vitals_intro,
    x: MARGIN + 20,
    y: cursorY + 28,
    width: CONTENT_WIDTH - 40,
    fontSize: 12,
    lineHeight: 18,
    color: [30, 64, 175],
    fontStyle: "bold"
  });

  cursorY += vitalsIntroHeight + 18;
  narrative.overview.vitals.forEach((metric, index) => {
    const scoreTone =
      index === 0
        ? getTone(input.scan.lcp !== null && input.scan.lcp <= 2500 ? 92 : input.scan.lcp !== null && input.scan.lcp <= 4000 ? 76 : 45)
        : index === 1
          ? getTone(input.scan.fid !== null && input.scan.fid <= 100 ? 95 : input.scan.fid !== null && input.scan.fid <= 300 ? 76 : 45)
          : getTone(input.scan.cls !== null && input.scan.cls <= 0.1 ? 96 : input.scan.cls !== null && input.scan.cls <= 0.25 ? 74 : 42);
    const metricHeight = Math.max(150, 82 + estimateTextHeight(doc, metric.explanation, CONTENT_WIDTH - 40, 18));

    if (cursorY + metricHeight > PAGE_HEIGHT - 90) {
      startNewPage("Google's 3 Key Measurements", "Continued");
      cursorY = 124;
    }

    drawRoundedCard(doc, MARGIN, cursorY, CONTENT_WIDTH, metricHeight, [255, 255, 255]);
    drawPill(doc, metric.status_label, MARGIN + 20, cursorY + 18, scoreTone.fill);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(15, 23, 42);
    doc.text(`${index + 1}. ${metric.title}: ${metric.value_label}`, MARGIN + 20, cursorY + 58);
    drawMultilineText({
      doc,
      text: metric.explanation,
      x: MARGIN + 20,
      y: cursorY + 84,
      width: CONTENT_WIDTH - 40,
      fontSize: 12,
      lineHeight: 18,
      color: [71, 85, 105]
    });
    cursorY += metricHeight + 16;
  });

  const vitalsOverallHeight = Math.max(
    88,
    44 + estimateTextHeight(doc, narrative.overview.vitals_overall, CONTENT_WIDTH - 40, 18)
  );
  if (cursorY + vitalsOverallHeight > PAGE_HEIGHT - 60) {
    startNewPage("Google's 3 Key Measurements", "Continued");
    cursorY = 124;
  }
  drawRoundedCard(doc, MARGIN, cursorY, CONTENT_WIDTH, vitalsOverallHeight, [15, 23, 42], [15, 23, 42]);
  drawMultilineText({
    doc,
    text: narrative.overview.vitals_overall,
    x: MARGIN + 20,
    y: cursorY + 30,
    width: CONTENT_WIDTH - 40,
    fontSize: 12,
    lineHeight: 18,
    color: [226, 232, 240],
    fontStyle: "bold"
  });

  startNewPage("Mobile vs Desktop", "How your website feels across devices");

  cursorY = 124;
  const deviceIntroHeight = Math.max(
    74,
    46 + estimateTextHeight(doc, narrative.overview.device_intro, CONTENT_WIDTH - 40, 18)
  );
  drawRoundedCard(doc, MARGIN, cursorY, CONTENT_WIDTH, deviceIntroHeight, [239, 246, 255], [191, 219, 254]);
  drawMultilineText({
    doc,
    text: narrative.overview.device_intro,
    x: MARGIN + 20,
    y: cursorY + 30,
    width: CONTENT_WIDTH - 40,
    fontSize: 12,
    lineHeight: 18,
    color: [30, 64, 175],
    fontStyle: "bold"
  });

  const mobileScore = input.scan.mobile_snapshot?.performance_score ?? input.scan.performance_score;
  const desktopScore = input.scan.desktop_snapshot?.performance_score ?? input.scan.performance_score;
  const cardY = cursorY + deviceIntroHeight + 24;
  const halfWidth = (CONTENT_WIDTH - 16) / 2;
  const deviceCardHeight =
    Math.max(
      estimateTextHeight(doc, narrative.overview.mobile_summary, halfWidth - 40, 18),
      estimateTextHeight(doc, narrative.overview.desktop_summary, halfWidth - 40, 18)
    ) + 140;

  [
    {
      title: "Mobile Performance",
      score: mobileScore,
      summary: narrative.overview.mobile_summary
    },
    {
      title: "Desktop Performance",
      score: desktopScore,
      summary: narrative.overview.desktop_summary
    }
  ].forEach((card, index) => {
    const x = MARGIN + index * (halfWidth + 16);
    drawRoundedCard(doc, x, cardY, halfWidth, deviceCardHeight, [255, 255, 255]);
    const tone = getTone(card.score);
    drawPill(doc, tone.label, x + 20, cardY + 18, tone.fill);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text(card.title, x + 20, cardY + 58);
    doc.setFontSize(34);
    doc.text(String(card.score), x + 20, cardY + 104);
    drawMultilineText({
      doc,
      text: card.summary,
      x: x + 20,
      y: cardY + 132,
      width: halfWidth - 40,
      fontSize: 12,
      lineHeight: 18,
      color: [71, 85, 105]
    });
  });

  const tipY = cardY + deviceCardHeight + 20;
  const tipHeight = Math.max(72, 42 + estimateTextHeight(doc, narrative.overview.device_tip, CONTENT_WIDTH - 40, 18));
  drawRoundedCard(doc, MARGIN, tipY, CONTENT_WIDTH, tipHeight, [15, 23, 42], [15, 23, 42]);
  drawMultilineText({
    doc,
    text: narrative.overview.device_tip,
    x: MARGIN + 20,
    y: tipY + 30,
    width: CONTENT_WIDTH - 40,
    fontSize: 12,
    lineHeight: 18,
    color: [226, 232, 240],
    fontStyle: "bold"
  });

  doc.addPage();
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, "F");

  let closingY = 132;

  if (logoDataUrl) {
    try {
      const image = doc.getImageProperties(logoDataUrl);
      const maxWidth = 130;
      const maxHeight = 42;
      const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
      const width = image.width * scale;
      const height = image.height * scale;
      const imageType = typeof image.fileType === "string" ? image.fileType.toUpperCase() : "PNG";
      doc.addImage(logoDataUrl, imageType, PAGE_WIDTH / 2 - width / 2, closingY, width, height, undefined, "FAST");
      closingY += height + 30;
    } catch {
      // Ignore logo draw failures on the fallback renderer.
    }
  }

  doc.setTextColor(248, 250, 252);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  const thankYouLines = splitLines(doc, `Thank you for choosing ${brandName}`, 320);
  doc.text(thankYouLines, PAGE_WIDTH / 2, closingY, { align: "center" });
  closingY += thankYouLines.length * 30 + 24;

  const drawClosingDivider = (y: number) => {
    doc.setDrawColor(30, 41, 59);
    doc.setLineWidth(1);
    doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  };

  drawClosingDivider(closingY);
  closingY += 34;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(100, 116, 139);
  doc.text("Reply-to email", PAGE_WIDTH / 2, closingY, { align: "center" });
  closingY += 28;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(96, 165, 250);
  doc.text(replyToEmail, PAGE_WIDTH / 2, closingY, { align: "center", maxWidth: CONTENT_WIDTH });
  closingY += 42;

  drawClosingDivider(closingY);
  closingY += 34;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(100, 116, 139);
  doc.text("Next report date", PAGE_WIDTH / 2, closingY, { align: "center" });
  closingY += 28;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(96, 165, 250);
  doc.text(nextReportDate, PAGE_WIDTH / 2, closingY, { align: "center", maxWidth: CONTENT_WIDTH });
  closingY += 28;

  if (footerNote) {
    drawClosingDivider(closingY + 14);
    closingY += 46;
    drawMultilineText({
      doc,
      text: footerNote,
      x: MARGIN + 30,
      y: closingY,
      width: CONTENT_WIDTH - 60,
      fontSize: 12,
      lineHeight: 18,
      color: [148, 163, 184]
    });
  }

  applyPageFooters({
    doc,
    agencyName: brandName,
    agencyWebsite: footerWebsite
  });

  return Buffer.from(doc.output("arraybuffer"));
}
