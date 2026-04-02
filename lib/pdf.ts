import "server-only";

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import type { AgencyBranding, ScanResult, Website } from "@/types";
import { formatDateTime } from "@/lib/utils";

function hexToRgb(hex: string) {
  const clean = hex.replace("#", "");
  const normalized = clean.length === 3 ? clean.split("").map((char) => `${char}${char}`).join("") : clean;
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

function drawScoreCard(doc: any, x: number, y: number, label: string, value: number) {
  const tone = value >= 90 ? "#22C55E" : value >= 50 ? "#F59E0B" : "#EF4444";
  const rgb = hexToRgb(tone);

  doc.setFillColor(30, 41, 59);
  doc.roundedRect(x, y, 118, 80, 18, 18, "F");
  doc.setDrawColor(71, 85, 105);
  doc.roundedRect(x, y, 118, 80, 18, 18);
  doc.setTextColor(148, 163, 184);
  doc.setFontSize(10);
  doc.text(label.toUpperCase(), x + 16, y + 18);
  doc.setFontSize(28);
  doc.setTextColor(rgb.r, rgb.g, rgb.b);
  doc.setFont("helvetica", "bold");
  doc.text(String(value), x + 16, y + 52);
  doc.setFont("helvetica", "normal");
}

function drawHistoryGraph(doc: any, scans: ScanResult[], x: number, y: number) {
  const history = scans.slice(-4);
  if (history.length < 2) {
    return;
  }

  const width = 220;
  const height = 90;
  const step = width / (history.length - 1);

  doc.setTextColor(248, 250, 252);
  doc.setFontSize(12);
  doc.text("Last 4 scans", x, y - 12);
  doc.setDrawColor(71, 85, 105);
  doc.line(x, y + height, x + width, y + height);
  doc.line(x, y, x, y + height);

  const points = history.map((scan, index) => ({
    score: scan.performance_score,
    x: x + index * step,
    y: y + height - scan.performance_score * 0.8,
    label: new Date(scan.scanned_at).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric"
    })
  }));

  doc.setDrawColor(59, 130, 246);
  doc.setLineWidth(2);
  points.forEach((point, index) => {
    if (index === 0) {
      return;
    }

    const previous = points[index - 1];
    doc.line(previous.x, previous.y, point.x, point.y);
  });

  points.forEach((point) => {
    doc.setFillColor(59, 130, 246);
    doc.circle(point.x, point.y, 3, "F");
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text(point.label, point.x - 12, y + height + 14);
    doc.text(String(point.score), point.x - 5, point.y - 8);
  });
}

export async function generateScanPdf(input: {
  website: Website;
  scan: ScanResult;
  history: ScanResult[];
  branding?: AgencyBranding | null;
}) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const brandColor = input.branding?.brand_color || "#3B82F6";
  const brandRgb = hexToRgb(brandColor);
  const brandName = input.branding?.agency_name || "SitePulse";
  const emailFromName = input.branding?.email_from_name || brandName;

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 595, 160, "F");
  doc.setFillColor(brandRgb.r, brandRgb.g, brandRgb.b);
  doc.rect(0, 0, 595, 8, "F");

  let brandTextX = 42;
  if (input.branding?.logo_url) {
    try {
      const dataUrl = await fetchImageAsDataUrl(input.branding.logo_url);
      const image = doc.getImageProperties(dataUrl);
      const maxWidth = 140;
      const maxHeight = 44;
      const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
      const width = image.width * scale;
      const height = image.height * scale;
      const imageType = typeof image.fileType === "string" ? image.fileType.toUpperCase() : "PNG";
      doc.addImage(dataUrl, imageType, 42, 30, width, height);
      brandTextX = 42 + width + 16;
    } catch {
      // Text logo fallback below.
    }
  }

  doc.setTextColor(248, 250, 252);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.text(brandName, brandTextX, 54);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(`White-label report prepared by ${emailFromName}`, brandTextX, 76);
  doc.text(input.website.label, 42, 100);
  doc.text(input.website.url, 42, 120, { maxWidth: 450 });
  doc.text(formatDateTime(input.scan.scanned_at), 42, 140);

  drawScoreCard(doc, 42, 186, "Performance", input.scan.performance_score);
  drawScoreCard(doc, 174, 186, "SEO", input.scan.seo_score);
  drawScoreCard(doc, 306, 186, "Accessibility", input.scan.accessibility_score);
  drawScoreCard(doc, 438, 186, "Best Practices", input.scan.best_practices_score);

  autoTable(doc, {
    startY: 286,
    margin: { left: 42, right: 42 },
    head: [["Metric", "Value"]],
    body: [
      ["Largest Contentful Paint", `${Math.round(input.scan.lcp ?? 0)} ms`],
      ["First Input Delay", `${Math.round(input.scan.fid ?? 0)} ms`],
      ["Cumulative Layout Shift", `${input.scan.cls ?? 0}`],
      ["Total Blocking Time", `${Math.round(input.scan.tbt ?? 0)} ms`]
    ],
    headStyles: {
      fillColor: [brandRgb.r, brandRgb.g, brandRgb.b]
    },
    bodyStyles: {
      fillColor: [30, 41, 59],
      textColor: [248, 250, 252]
    }
  });

  const chartStartY = ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 320) + 36;
  drawHistoryGraph(doc, input.history, 42, chartStartY);

  autoTable(doc, {
    startY: chartStartY,
    margin: { left: 300, right: 42 },
    head: [["Device", "Performance", "Accessibility"]],
    body: [
      [
        "Mobile",
        String(input.scan.mobile_snapshot?.performance_score ?? input.scan.performance_score),
        String(input.scan.mobile_snapshot?.accessibility_score ?? input.scan.accessibility_score)
      ],
      [
        "Desktop",
        String(input.scan.desktop_snapshot?.performance_score ?? input.scan.performance_score),
        String(input.scan.desktop_snapshot?.accessibility_score ?? input.scan.accessibility_score)
      ]
    ],
    headStyles: {
      fillColor: [15, 23, 42]
    },
    bodyStyles: {
      fillColor: [30, 41, 59],
      textColor: [248, 250, 252]
    }
  });

  autoTable(doc, {
    startY: Math.max(
      chartStartY + 130,
      ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 420) + 20
    ),
    margin: { left: 42, right: 42 },
    head: [["Accessibility violations", "Severity"]],
    body:
      input.scan.accessibility_violations?.length
        ? input.scan.accessibility_violations.slice(0, 8).map((violation) => [
            String((violation.help as string | undefined) ?? (violation.message as string | undefined) ?? "Accessibility issue"),
            String((violation.severity as string | undefined) ?? (violation.impact as string | undefined) ?? "medium")
          ])
        : [["No accessibility violations recorded", "low"]],
    headStyles: {
      fillColor: [brandRgb.r, brandRgb.g, brandRgb.b]
    },
    bodyStyles: {
      fillColor: [30, 41, 59],
      textColor: [248, 250, 252]
    }
  });

  doc.addPage();
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 595, 842, "F");

  autoTable(doc, {
    startY: 42,
    margin: { left: 42, right: 42 },
    head: [["Issues", "Severity", "Notes"]],
    body: input.scan.issues.length
      ? input.scan.issues.map((issue) => [issue.title, issue.severity, issue.description])
      : [["No major issues found", "-", "-"]],
    headStyles: {
      fillColor: [brandRgb.r, brandRgb.g, brandRgb.b]
    },
    bodyStyles: {
      fillColor: [30, 41, 59],
      textColor: [248, 250, 252]
    }
  });

  autoTable(doc, {
    startY: ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 160) + 20,
    margin: { left: 42, right: 42 },
    head: [["Recommendations", "Priority", "Link"]],
    body: input.scan.recommendations.length
      ? input.scan.recommendations.map((item) => [item.title, item.priority, item.link ?? "-"])
      : [["No recommendations available", "-", "-"]],
    headStyles: {
      fillColor: [59, 130, 246]
    },
    bodyStyles: {
      fillColor: [30, 41, 59],
      textColor: [248, 250, 252]
    }
  });

  return Buffer.from(doc.output("arraybuffer"));
}
