export interface ReportContext {
  agency_name: string;
  agency_logo_url: string;
  agency_email: string;
  agency_website_url: string;
  report_footer_text: string;
  white_label?: boolean;
  brand_color: string;
  client_name: string;
  website_url: string;
  report_date: string;
  next_report_date: string;
  health_score: number;
  scores: {
    performance: number;
    seo: number;
    accessibility: number;
    best_practices: number;
  };
  deltas: {
    performance: number | null;
    seo: number | null;
    accessibility: number | null;
    best_practices: number | null;
    is_baseline: boolean;
  };
  industry_score: number;
  seo_audit: {
    title_tag: { value: string; chars: number; status: "pass" | "fail" };
    meta_description: { value: string; chars: number; status: "pass" | "fail" };
    heading_structure: { h1: number; h2: number; h3: number; status: "pass" | "fail" };
    images_missing_alt: number;
    open_graph: { status: "complete" | "needs_attention" | "missing" };
    canonical: { status: "self_referencing" | "not_self_referencing" | "missing" };
    action_chips: string[];
  };
  link_health: {
    total_links: number;
    broken_links: number;
    redirect_chains: number;
  };
  security: {
    ssl_status: "healthy" | "warning" | "expired";
    ssl_days_until_expiry: number;
    ssl_authority: string;
    headers_grade: "A" | "B" | "C" | "D" | "F";
    headers_present: number;
    health_score: number;
    headers: {
      hsts: { value: string | null; status: "pass" | "fail" };
      content_security_policy: { value: string | null; status: "pass" | "fail" };
      x_frame_options: { value: string | null; status: "pass" | "fail" };
      referrer_policy: { value: string | null; status: "pass" | "fail" };
      permissions_policy: { value: string | null; status: "pass" | "fail" };
      x_content_type_options: { value: string | null; status: "pass" | "fail" };
    };
  };
  issues: Array<{
    priority: "critical" | "high" | "medium";
    title: string;
    estimated_time: string;
    difficulty: "easy" | "medium" | "hard";
    what_is_happening: string;
    why_it_matters: string;
    root_cause: string;
    how_to_fix: string;
  }>;
  business_impact: {
    traffic: string;
    conversions: string;
    engagement: string;
    callout: string;
  };
  plan: {
    week1: { goal: string; tasks: Array<{ label: string; time: string }> };
    week2: { goal: string; tasks: Array<{ label: string; time: string }> };
    week3_4: { goal: string; tasks: Array<{ label: string; time: string }> };
    priority_actions: Array<{
      priority: "critical" | "high";
      difficulty: string;
      time: string;
      title: string;
      action: string;
      expected_impact: string;
    }>;
    current_score: number;
    projected_min: number;
    projected_max: number;
  };
  vitals: {
    lcp: { value: number; status: "good" | "needs_improvement" | "slow" | "poor" };
    inp: { value: number; status: "good" | "needs_improvement" | "poor" };
    cls: { value: number; status: "good" | "needs_improvement" | "poor" };
    summary: string;
  };
  uptime: {
    status: "monitoring_active" | "data_available";
    percentage: number | null;
    incidents: number;
    avg_response_ms: number | null;
    crux_available: boolean;
    real_user_speed_pct: number | null;
    loading_good: number | null;
    loading_poor: number | null;
    stability_good: number | null;
    stability_poor: number | null;
    interaction_good: number | null;
    interaction_poor: number | null;
    ttfb_good: number | null;
    ttfb_poor: number | null;
  };
  devices: {
    mobile: { score: number; status: "critical" | "needs_attention" | "good" | "excellent" };
    desktop: { score: number; status: "critical" | "needs_attention" | "good" | "excellent" };
    callout: string;
  };
}

const COLORS = {
  success: "#10B981",
  info: "#3B82F6",
  warning: "#F59E0B",
  danger: "#EF4444",
  ink: "#0F172A",
  muted: "#64748B",
  darkAccent: "#60A5FA"
} as const;

function esc(value: string | number | null | undefined) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");
}

function statusFromScore(score: number): "critical" | "needs_attention" | "good" | "excellent" {
  if (score < 50) return "critical";
  if (score < 70) return "needs_attention";
  if (score < 85) return "good";
  return "excellent";
}

function label(value: string) {
  const labels: Record<string, string> = {
    critical: "Critical",
    needs_attention: "Needs Attention",
    good: "Good",
    excellent: "Excellent",
    healthy: "Healthy",
    warning: "Warning",
    expired: "Expired",
    pass: "Pass",
    fail: "Fail",
    complete: "Complete",
    missing: "Missing",
    needs_improvement: "Needs Improvement",
    slow: "Slow",
    poor: "Poor"
  };
  return labels[value] ?? value;
}

function tone(value: string) {
  const tones: Record<string, string> = {
    critical: "background:#FEE2E2;color:#991B1B;border:1px solid #FCA5A5",
    needs_attention: "background:#FEF3C7;color:#92400E;border:1px solid #FCD34D",
    good: "background:#DBEAFE;color:#1E40AF;border:1px solid #93C5FD",
    excellent: "background:#D1FAE5;color:#065F46;border:1px solid #6EE7B7",
    healthy: "background:#D1FAE5;color:#065F46;border:1px solid #6EE7B7",
    warning: "background:#FEF3C7;color:#92400E;border:1px solid #FCD34D",
    expired: "background:#FEE2E2;color:#991B1B;border:1px solid #FCA5A5",
    pass: "background:#D1FAE5;color:#065F46;border:1px solid #6EE7B7",
    fail: "background:#FEE2E2;color:#991B1B;border:1px solid #FCA5A5",
    complete: "background:#D1FAE5;color:#065F46;border:1px solid #6EE7B7",
    missing: "background:#FEE2E2;color:#991B1B;border:1px solid #FCA5A5",
    needs_improvement: "background:#FEF3C7;color:#92400E;border:1px solid #FCD34D",
    slow: "background:#FEE2E2;color:#991B1B;border:1px solid #FCA5A5",
    poor: "background:#FEE2E2;color:#991B1B;border:1px solid #FCA5A5"
  };
  return tones[value] ?? "background:#F1F5F9;color:#475569;border:1px solid #CBD5E1";
}

function badge(value: string, text?: string) {
  return `<span style="display:inline-block;padding:3px 10px;border-radius:999px;font-size:10px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;${tone(value)}">${esc(text ?? label(value))}</span>`;
}

function sectionLabel(text: string) {
  return `<p style="font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#94A3B8;margin:0 0 6px">${esc(text)}</p>`;
}

function card(inner: string, style = "") {
  return `<div style="background:#fff;border:1px solid #E2E8F0;border-radius:10px;padding:14px;${style}">${inner}</div>`;
}

function footer(context: ReportContext, page: number, total = 13) {
  const darkPage = page === 1 || page === total;
  const color = darkPage ? "#64748B" : "#94A3B8";
  const border = darkPage ? "#1E293B" : "#E2E8F0";

  return `<div style="position:absolute;left:17mm;right:17mm;bottom:14mm;color:${color};border-top:1px solid ${border};padding-top:6px"><div style="position:relative;min-height:14px;font-size:10px"><span style="position:absolute;left:0;top:0;max-width:calc(50% - 24px);padding-left:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:left">${esc(context.agency_name)}</span><span style="position:absolute;left:50%;top:0;transform:translateX(-50%);max-width:calc(100% - 160px);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:center">${esc(context.agency_website_url)}</span><span style="position:absolute;right:0;top:0;padding-right:8px;white-space:nowrap;text-align:right">Page ${page} of ${total}</span></div></div>`;
}

function ring(score: number, size = 76) {
  const status = statusFromScore(score);
  const color = status === "critical" ? COLORS.danger : status === "needs_attention" ? COLORS.warning : status === "good" ? COLORS.info : COLORS.success;
  const radius = size / 2 - 5;
  const circumference = 2 * Math.PI * radius;
  const fill = (score / 100) * circumference;
  const center = size / 2;

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="display:block;margin:0 auto 8px"><circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="#E2E8F0" stroke-width="5"/><circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="${color}" stroke-width="5" stroke-dasharray="${fill.toFixed(1)} ${circumference.toFixed(1)}" stroke-linecap="round" transform="rotate(-90 ${center} ${center})"/><text x="${center}" y="${center}" text-anchor="middle" dominant-baseline="central" style="font-size:20px;font-weight:800;fill:${color}">${score}</text></svg>`;
}

function formatLcpSeconds(value: number) {
  const seconds = value > 100 ? value / 1000 : value;
  return seconds.toFixed(2);
}

function lcpSeconds(value: number) {
  return value > 100 ? value / 1000 : value;
}

function lcpStatus(value: number): "good" | "needs_improvement" | "slow" {
  const seconds = lcpSeconds(value);
  if (seconds < 2.5) return "good";
  if (seconds <= 4) return "needs_improvement";
  return "slow";
}

function buildBusinessImpactCopy(context: ReportContext) {
  const { performance, seo, accessibility, best_practices } = context.scores;

  const traffic =
    seo >= 85
      ? `SEO score is ${seo}/100, so search engines can understand and rank key pages more reliably for new visitor discovery.`
      : seo >= 70
        ? `SEO score is ${seo}/100, which means the site is indexable but missing signals are still limiting rankings and non-brand traffic.`
        : `SEO score is ${seo}/100, which means important discovery signals are weak and organic acquisition is likely being constrained.`;

  const conversions =
    performance >= 85
      ? `Performance score is ${performance}/100, so most visitors can reach forms, products, and enquiries without meaningful delay.`
      : performance >= 70
        ? `Performance score is ${performance}/100, which means some visitors will face load friction before reaching key conversion actions.`
        : performance >= 50
          ? `Performance score is ${performance}/100, so speed friction is likely increasing abandonment before visitors complete high-value actions.`
          : `Performance score is ${performance}/100, which indicates severe load friction that is likely blocking conversions at the top of the funnel.`;

  const engagement =
    accessibility >= 85 && best_practices >= 85
      ? `Accessibility is ${accessibility}/100 and best practices is ${best_practices}/100, supporting stronger trust, deeper sessions, and smoother repeat visits.`
      : accessibility < 70
        ? `Accessibility is ${accessibility}/100, so structural and interaction barriers are making the site harder to use for a meaningful share of visitors.`
        : `Best practices is ${best_practices}/100 and accessibility is ${accessibility}/100, so trust and usability friction are still reducing session depth.`;

  const callout =
    performance < 70 || seo < 70
      ? `The biggest opportunity is to remove speed and discovery friction first, then use the remaining work to improve trust and session quality.`
      : `This site is already functional, but focused cleanup should still strengthen discovery, reduce friction, and improve conversion efficiency.`;

  return { traffic, conversions, engagement, callout };
}

function clampHeaderValue(value: string | null | undefined, max = 48) {
  const text = value ?? "Missing";
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function deltaBadge(value: number | null, name: string) {
  const safe = value ?? 0;
  const deltaColor = safe > 0 ? COLORS.success : safe < 0 ? COLORS.danger : "#475569";
  const bg = safe > 0 ? "#D1FAE5" : safe < 0 ? "#FEE2E2" : "#F1F5F9";
  const border = safe > 0 ? "#6EE7B7" : safe < 0 ? "#FCA5A5" : "#CBD5E1";
  const arrow = safe > 0 ? "&uarr;" : safe < 0 ? "&darr;" : "&rarr;";
  const amount = safe > 0 ? `+${Math.abs(safe)}` : safe < 0 ? `-${Math.abs(safe)}` : "0";

  return `<div style="background:${bg};border:1px solid ${border};border-radius:8px;padding:8px 10px;display:flex;justify-content:space-between;gap:8px"><span style="font-size:12px;font-weight:600;color:${COLORS.muted}">${esc(name)}</span><span style="font-size:12px;font-weight:700;color:${deltaColor}">${arrow} ${amount}</span></div>`;
}

function issueCard(issue: ReportContext["issues"][number]) {
  return `<div style="background:#fff;border:1px solid #E2E8F0;border-radius:10px;padding:14px;margin-bottom:12px"><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:8px"><div>${badge(issue.priority, issue.priority === "high" ? "High" : issue.priority === "medium" ? "Medium" : "Critical")}</div><div style="display:flex;gap:8px;flex-wrap:wrap"><span style="font-size:11px;background:#F1F5F9;border:1px solid #E2E8F0;border-radius:999px;padding:3px 10px;color:#475569">${esc(issue.estimated_time)}</span><span style="font-size:11px;background:#F1F5F9;border:1px solid #E2E8F0;border-radius:999px;padding:3px 10px;color:#475569">${esc(issue.difficulty)}</span></div></div><h3 style="font-size:14px;font-weight:700;color:${COLORS.ink};margin:0 0 10px;line-height:1.35;word-break:break-word">${esc(issue.title)}</h3><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><div style="background:#F8FAFC;border-radius:8px;padding:10px"><p style="font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#94A3B8;margin:0 0 4px">What's Happening</p><p style="font-size:12px;color:#334155;margin:0;line-height:1.55">${esc(issue.what_is_happening)}</p></div><div style="background:#F8FAFC;border-radius:8px;padding:10px"><p style="font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#94A3B8;margin:0 0 4px">Why It Matters</p><p style="font-size:12px;color:#334155;margin:0;line-height:1.55">${esc(issue.why_it_matters)}</p></div><div style="background:#F8FAFC;border-radius:8px;padding:10px"><p style="font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#94A3B8;margin:0 0 4px">Root Cause</p><p style="font-size:12px;color:#334155;margin:0;line-height:1.55">${esc(issue.root_cause)}</p></div><div style="background:#F8FAFC;border-radius:8px;padding:10px"><p style="font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#94A3B8;margin:0 0 4px">How To Fix It</p><p style="font-size:12px;color:#334155;margin:0;line-height:1.55">${esc(issue.how_to_fix)}</p></div></div></div>`;
}

function normalizeIssueTitle(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function issueMatches(issue: ReportContext["issues"][number], patterns: string[]) {
  const title = normalizeIssueTitle(issue.title);
  return patterns.some((pattern) => title.includes(pattern));
}

function routeIssuesForFixedPages(issues: ReportContext["issues"]) {
  const remaining = [...issues];
  const takeOne = (patterns: string[]) => {
    const index = remaining.findIndex((issue) => issueMatches(issue, patterns));
    return index >= 0 ? remaining.splice(index, 1)[0] : null;
  };

  const pageStructureIssue = takeOne([
    "page structure issues affect user experience",
    "page structure",
    "heading structure",
    "accessibility structure"
  ]);

  const searchEnginesIssue = takeOne([
    "search engines struggle to understand key pages",
    "seo discovery",
    "search engines struggle",
    "understand key pages"
  ]);

  const urgentPool = remaining.filter((issue) => issue.priority === "critical" || issue.priority === "high");
  const mediumPool = remaining.filter((issue) => issue.priority === "medium");
  const urgentUsed = new Set<ReportContext["issues"][number]>();

  const page5Issues = urgentPool.filter((issue) => {
    if (urgentUsed.size >= 2) return false;
    urgentUsed.add(issue);
    return true;
  });

  const page6Issues = [
    ...(pageStructureIssue ? [pageStructureIssue] : []),
    ...urgentPool.filter((issue) => !urgentUsed.has(issue)).slice(0, pageStructureIssue ? 1 : 2)
  ];

  page6Issues.forEach((issue) => urgentUsed.add(issue));

  const page7Issues = [
    ...(searchEnginesIssue ? [searchEnginesIssue] : []),
    ...urgentPool.filter((issue) => !urgentUsed.has(issue)),
    ...mediumPool
  ].slice(0, 3);

  return {
    page5Issues,
    page6Issues,
    page7Issues,
    pageStructureIssue,
    searchEnginesIssue,
    totalIssues: issues.length,
    criticalCount: issues.filter((issue) => issue.priority === "critical").length,
    highCount: issues.filter((issue) => issue.priority === "high").length,
    mediumCount: issues.filter((issue) => issue.priority === "medium").length
  };
}

function page1(context: ReportContext) {
  return `<section class="page" style="background:${COLORS.ink};display:flex;flex-direction:column;align-items:center;justify-content:space-between;text-align:center"><div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%">${context.agency_logo_url ? `<img src="${esc(context.agency_logo_url)}" alt="${esc(context.agency_name)}" style="max-height:48px;max-width:180px;object-fit:contain;margin-bottom:12px;filter:brightness(0) invert(1)"/>` : ""}<p style="font-size:14px;color:#94A3B8;margin:0 0 54px">${esc(context.agency_name)}</p><h1 style="font-size:34px;font-weight:300;color:#F8FAFC;margin:0 0 10px">Monthly Website Report</h1><p style="font-size:16px;font-weight:700;color:${COLORS.darkAccent};margin:0 0 8px">${esc(context.website_url)}</p><p style="font-size:13px;color:#94A3B8;margin:0">${esc(context.report_date)}</p></div><div style="width:100%;background:#F8FAFC;border-radius:12px;padding:20px 24px;margin-bottom:34px;text-align:left"><div style="margin-bottom:10px"><p style="font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#94A3B8;margin:0 0 2px">Prepared For</p><p style="font-size:15px;font-weight:700;color:${COLORS.ink};margin:0">${esc(context.client_name)}</p></div><div style="margin-bottom:10px"><p style="font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#94A3B8;margin:0 0 2px">Prepared By</p><p style="font-size:15px;font-weight:700;color:${COLORS.ink};margin:0">${esc(context.agency_name)}</p></div><div style="margin-bottom:14px"><p style="font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#94A3B8;margin:0 0 2px">Health Score</p><p style="font-size:36px;font-weight:800;color:${COLORS.ink};margin:0;line-height:1;white-space:nowrap">${context.health_score}<span style="font-size:18px;color:${COLORS.muted}">/100</span></p></div><div style="border-top:1px solid #E2E8F0;padding-top:12px"><p style="font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#94A3B8;margin:0 0 2px">Next Report Date</p><p style="font-size:15px;font-weight:700;color:${COLORS.ink};margin:0">${esc(context.next_report_date)}</p></div></div>${footer(context, 1)}</section>`;
}

function page2(context: ReportContext) {
  const overall = statusFromScore(context.health_score);
  const scoreCard = (labelText: string, key: keyof ReportContext["scores"], subheading: string, description: string) => card(`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><span style="font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#94A3B8">${labelText}</span>${badge(statusFromScore(context.scores[key]))}</div>${ring(context.scores[key])}<p style="font-size:13px;font-weight:700;color:${COLORS.ink};margin:0 0 4px;text-align:center">${esc(subheading)}</p><p style="font-size:11px;color:${COLORS.muted};margin:0;line-height:1.5;text-align:center">${esc(description)}</p>`);

  return `<section class="page">${sectionLabel("Executive Summary")}<h2 style="font-size:24px;font-weight:800;color:${COLORS.ink};margin:0 0 4px">Executive Summary</h2><p style="font-size:12px;color:${COLORS.muted};margin:0 0 16px">Scores, change since the last scan, and an industry benchmark snapshot.</p><div style="display:flex;justify-content:space-between;align-items:center;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:12px 16px;margin-bottom:16px"><div>${badge(overall)}</div><div style="text-align:right"><p style="font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#94A3B8;margin:0">Overall Score</p><p style="font-size:28px;font-weight:800;color:${COLORS.ink};margin:0;line-height:1;white-space:nowrap">${context.health_score}<span style="font-size:14px;color:${COLORS.muted}">/100</span></p></div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">${scoreCard("Performance", "performance", "Performance Overview", context.scores.performance < 50 ? "Your website feels slow, which reduces trust and weakens completed actions." : context.scores.performance < 70 ? "Performance needs attention because slower visits reduce completed actions." : "Performance is in good shape and supports smoother visits for most users.")}${scoreCard("SEO", "seo", "Search Visibility", context.scores.seo >= 85 ? "Search engines can understand your pages clearly, supporting stronger discovery." : "SEO signals need improvement to strengthen rankings and organic traffic.")}${scoreCard("Accessibility", "accessibility", "Accessibility Status", context.scores.accessibility >= 85 ? "Your site is easier to use for more visitors, with stronger structure." : "Accessibility issues are creating friction for visitors who rely on clearer structure.")}${scoreCard("Best Practices", "best_practices", "Standards Compliance", context.scores.best_practices >= 85 ? "Technical standards are strong, supporting reliability and visitor trust." : "Technical standards need cleanup to improve reliability and confidence.")}</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><div>${card(`<h3 style="font-size:14px;font-weight:700;color:${COLORS.ink};margin:0 0 10px">Score Changes</h3>${context.deltas.is_baseline ? `<p style="font-size:12px;color:${COLORS.muted};margin:0 0 10px">This is your baseline report. Future changes will be measured from these scores.</p>` : `<p style="font-size:12px;color:${COLORS.muted};margin:0 0 10px">Score changes since the last scan.</p>`}<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${deltaBadge(context.deltas.performance, "Performance")}${deltaBadge(context.deltas.seo, "SEO")}${deltaBadge(context.deltas.accessibility, "Accessibility")}${deltaBadge(context.deltas.best_practices, "Best Practices")}</div>`)}</div><div>${card(`<h3 style="font-size:14px;font-weight:700;color:${COLORS.ink};margin:0 0 4px">Industry Comparison</h3><p style="font-size:11px;color:${COLORS.muted};margin:0 0 12px">Your latest scan compared against a typical industry benchmark.</p><div style="display:grid;grid-template-columns:64px minmax(0,1fr) 36px;gap:8px;align-items:center;margin-bottom:8px"><span style="font-size:11px;color:#475569;white-space:nowrap">Your site</span><div style="background:#E2E8F0;border-radius:999px;height:10px;overflow:hidden"><div style="background:${esc(context.brand_color)};height:100%;width:${context.health_score}%"></div></div><span style="font-size:13px;font-weight:700;color:${COLORS.ink};text-align:right;white-space:nowrap">${context.health_score}</span></div><div style="display:grid;grid-template-columns:64px minmax(0,1fr) 36px;gap:8px;align-items:center"><span style="font-size:11px;color:#475569;white-space:nowrap">Industry</span><div style="background:#E2E8F0;border-radius:999px;height:10px;overflow:hidden"><div style="background:#94A3B8;height:100%;width:${context.industry_score}%"></div></div><span style="font-size:13px;font-weight:700;color:${COLORS.ink};text-align:right;white-space:nowrap">${context.industry_score}</span></div>`)}</div></div>${footer(context, 2)}</section>`;
}

function page3(context: ReportContext) {
  const seo = context.seo_audit;
  const auditItem = (name: string, value: string, status: "pass" | "fail") => card(`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><span style="font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#94A3B8">${name}</span>${badge(status)}</div><p style="font-size:12px;font-weight:600;color:${COLORS.ink};margin:0">${esc(value)}</p>`);

  return `<section class="page">${sectionLabel("Website Signals")}<h2 style="font-size:24px;font-weight:800;color:${COLORS.ink};margin:0 0 4px">SEO and Link Health</h2><p style="font-size:12px;color:${COLORS.muted};margin:0 0 16px">On-page SEO and internal link quality grouped into a fixed page for stable report rendering.</p><div style="margin-bottom:14px">${card(`<h3 style="font-size:14px;font-weight:700;color:${COLORS.ink};margin:0 0 10px">On-Page SEO Audit</h3><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">${auditItem("Title Tag", `${seo.title_tag.chars} characters`, seo.title_tag.status)}${auditItem("Meta Description", seo.meta_description.chars ? `${seo.meta_description.chars} characters` : "Missing · 0 chars", seo.meta_description.status)}${auditItem("Heading Structure", `H1 ${seo.heading_structure.h1}, H2 ${seo.heading_structure.h2}, H3 ${seo.heading_structure.h3}`, seo.heading_structure.status)}${auditItem("Images Missing Alt Text", String(seo.images_missing_alt), seo.images_missing_alt === 0 ? "pass" : "fail")}${auditItem("Open Graph Tags", seo.open_graph.status === "complete" ? "Complete" : seo.open_graph.status === "needs_attention" ? "Needs attention" : "Missing", seo.open_graph.status === "complete" ? "pass" : "fail")}${auditItem("Canonical Tag", seo.canonical.status === "self_referencing" ? "Self-referencing" : seo.canonical.status === "not_self_referencing" ? "Not self-referencing" : "Missing", seo.canonical.status === "self_referencing" ? "pass" : "fail")}</div>${seo.action_chips.length ? `<div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:8px">${seo.action_chips.map(chip => `<span style="display:inline-block;padding:4px 12px;border-radius:999px;font-size:11px;font-weight:600;color:${esc(context.brand_color)};border:1px solid ${esc(context.brand_color)}">${esc(chip)}</span>`).join("")}</div>` : ""}`)}</div><div>${card(`<h3 style="font-size:14px;font-weight:700;color:${COLORS.ink};margin:0 0 10px">Link Health</h3><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">${card(`<p style="font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#94A3B8;margin:0 0 4px">Total Links Checked</p><p style="font-size:28px;font-weight:800;color:${COLORS.ink};margin:0 0 4px">${context.link_health.total_links}</p><p style="font-size:11px;color:${COLORS.muted};margin:0">Internal links scanned from the latest crawl.</p>`)}${card(`<p style="font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#94A3B8;margin:0 0 4px">Broken Links</p><p style="font-size:28px;font-weight:800;color:${context.link_health.broken_links === 0 ? COLORS.success : COLORS.danger};margin:0 0 4px">${context.link_health.broken_links}</p><p style="font-size:11px;color:${COLORS.muted};margin:0">${context.link_health.broken_links === 0 ? "No broken internal links detected." : "Broken links found — fix these first."}</p>`)}${card(`<p style="font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#94A3B8;margin:0 0 4px">Redirect Chains</p><p style="font-size:28px;font-weight:800;color:${context.link_health.redirect_chains === 0 ? COLORS.success : COLORS.warning};margin:0 0 4px">${context.link_health.redirect_chains}</p><p style="font-size:11px;color:${COLORS.muted};margin:0">${context.link_health.redirect_chains === 0 ? "No redirect chains found." : "Redirect chains add speed friction."}</p>`)}</div>`)}</div>${footer(context, 3)}</section>`;
}
function page4(context: ReportContext) {
  const security = context.security;
  const headerRow = (name: string, header: { value: string | null; status: "pass" | "fail" }) => card(`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><span style="font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#94A3B8">${name}</span>${badge(header.status)}</div><p style="font-size:10px;color:#334155;margin:0;font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%">${esc(clampHeaderValue(header.value))}</p>`);

  return `<section class="page">${sectionLabel("Website Signals")}<h2 style="font-size:24px;font-weight:800;color:${COLORS.ink};margin:0 0 4px">Security &amp; SSL</h2><p style="font-size:12px;color:${COLORS.muted};margin:0 0 16px">Security and certificate coverage continue on a dedicated page so the full section never shifts.</p><div>${card(`<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">${card(`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><span style="font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#94A3B8">SSL Status</span>${badge(security.ssl_status)}</div><p style="font-size:12px;font-weight:600;color:${COLORS.ink};margin:0">${security.ssl_days_until_expiry} day(s) until expiry with ${esc(security.ssl_authority)}.</p>`)}${card(`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><span style="font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#94A3B8">Security Headers</span>${badge("good", security.headers_grade)}</div><p style="font-size:12px;font-weight:600;color:${COLORS.ink};margin:0">${security.headers_present} of 6 headers are present.</p>`)}</div><div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:10px;padding:12px;display:flex;gap:16px;align-items:center;margin-bottom:12px"><div><p style="font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#15803D;margin:0 0 2px">Health Score Security</p><p style="font-size:28px;font-weight:800;color:#15803D;margin:0;line-height:1;white-space:nowrap">${security.health_score}<span style="font-size:14px;color:#16A34A">/100</span></p></div><p style="font-size:11px;color:#166534;margin:0">Combined score from SSL certificate status and security headers.</p></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">${headerRow("HSTS", security.headers.hsts)}${headerRow("Content Security Policy", security.headers.content_security_policy)}${headerRow("X-Frame-Options", security.headers.x_frame_options)}${headerRow("Referrer-Policy", security.headers.referrer_policy)}${headerRow("Permissions-Policy", security.headers.permissions_policy)}${headerRow("X-Content-Type-Options", security.headers.x_content_type_options)}</div>`)}</div>${footer(context, 4)}</section>`;
}

function page5(context: ReportContext) {
  const routed = routeIssuesForFixedPages(context.issues);

  return `<section class="page">${sectionLabel("Issues Found")}<h2 style="font-size:24px;font-weight:800;color:${COLORS.ink};margin:0 0 4px">What Needs Attention</h2><p style="font-size:12px;color:${COLORS.muted};margin:0 0 6px">Critical issues appear first, followed by the highest-impact high-priority items.</p><p style="font-size:12px;font-weight:600;color:#475569;margin:0 0 14px">${routed.totalIssues} issues found — ${routed.criticalCount} critical, ${routed.highCount} high, ${routed.mediumCount} medium priority</p>${routed.page5Issues.length ? routed.page5Issues.map(issueCard).join("") : `<div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:16px"><p style="font-size:13px;font-weight:600;color:${COLORS.ink};margin:0 0 4px">No urgent issues scheduled on this page</p><p style="font-size:11px;color:${COLORS.muted};margin:0">The fixed page structure reserves this page for the highest-priority findings.</p></div>`}${footer(context, 5)}</section>`;
}

function page6(context: ReportContext) {
  const routed = routeIssuesForFixedPages(context.issues);

  return `<section class="page">${sectionLabel("Issues Found")}<h2 style="font-size:24px;font-weight:800;color:${COLORS.ink};margin:0 0 4px">What Needs Attention</h2><p style="font-size:12px;color:${COLORS.muted};margin:0 0 14px">This page is reserved for the page-structure finding and any tightly related urgent work.</p><div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:12px 14px;margin-bottom:12px"><p style="font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#94A3B8;margin:0 0 4px">Subsection</p><h3 style="font-size:16px;font-weight:700;color:${COLORS.ink};margin:0">Page Structure Issues Affect User Experience</h3></div>${routed.page6Issues.length ? routed.page6Issues.map(issueCard).join("") : `<div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:16px"><p style="font-size:13px;font-weight:600;color:${COLORS.ink};margin:0 0 4px">No page-structure issue was flagged in this scan</p><p style="font-size:11px;color:${COLORS.muted};margin:0">This page remains reserved so the same subsection always starts in the same place.</p></div>`}${footer(context, 6)}</section>`;
}

function page7(context: ReportContext) {
  const routed = routeIssuesForFixedPages(context.issues);

  return `<section class="page">${sectionLabel("More Findings")}<h2 style="font-size:24px;font-weight:800;color:${COLORS.ink};margin:0 0 4px">Additional Findings</h2><p style="font-size:12px;color:${COLORS.muted};margin:0 0 14px">The remaining issues continue here in a fixed position so search and structure findings never drift between pages.</p><div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:12px 14px;margin-bottom:12px"><p style="font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#94A3B8;margin:0 0 4px">Featured topic</p><h3 style="font-size:16px;font-weight:700;color:${COLORS.ink};margin:0">Search Engines Struggle to Understand Key Pages</h3></div>${routed.page7Issues.length ? routed.page7Issues.map(issueCard).join("") : `<div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:10px;padding:20px;text-align:center"><p style="font-size:14px;color:#166534;margin:0;font-weight:600">No additional findings.</p><p style="font-size:12px;color:#16A34A;margin:6px 0 0">All identified issues are already covered on the earlier pages.</p></div>`}${footer(context, 7)}</section>`;
}
function page8(context: ReportContext) {
  const impact = buildBusinessImpactCopy(context);

  return `<section class="page">${sectionLabel("Business Impact")}<h2 style="font-size:24px;font-weight:800;color:${COLORS.ink};margin:0 0 4px">Business Impact</h2><p style="font-size:12px;color:${COLORS.muted};margin:0 0 16px">How the current issues affect discovery, conversions, and engagement.</p><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:13px;margin-bottom:16px">${card(`<h3 style="font-size:14px;font-weight:700;color:${COLORS.ink};margin:0 0 8px">Traffic</h3><p style="font-size:12px;color:#475569;margin:0;line-height:1.6">${esc(impact.traffic)}</p>`)}${card(`<h3 style="font-size:14px;font-weight:700;color:${COLORS.ink};margin:0 0 8px">Conversions</h3><p style="font-size:12px;color:#475569;margin:0;line-height:1.6">${esc(impact.conversions)}</p>`)}${card(`<h3 style="font-size:14px;font-weight:700;color:${COLORS.ink};margin:0 0 8px">Engagement</h3><p style="font-size:12px;color:#475569;margin:0;line-height:1.6">${esc(impact.engagement)}</p>`)}</div><div style="border-left:3px solid ${esc(context.brand_color)};background:#F8FAFC;border-radius:0 8px 8px 0;padding:14px 16px"><p style="font-size:13px;color:#334155;margin:0;line-height:1.6">${esc(impact.callout)}</p></div>${footer(context, 8)}</section>`;
}

function page9(context: ReportContext) {
  const weekBox = (titleText: string, week: ReportContext["plan"]["week1"]) => `<div style="background:#fff;border:1px solid #E2E8F0;border-radius:10px;padding:14px;margin-bottom:12px"><h4 style="font-size:13px;font-weight:700;color:${COLORS.ink};margin:0 0 4px">${esc(titleText)}</h4><p style="font-size:11px;color:${COLORS.muted};margin:0 0 10px">${esc(week.goal)}</p>${week.tasks.map((task) => `<div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:6px"><span style="width:8px;height:8px;border-radius:50%;background:${esc(context.brand_color)};margin-top:4px;flex-shrink:0"></span><div><span style="font-size:12px;font-weight:600;color:#334155">${esc(task.label)}</span><span style="font-size:11px;color:#94A3B8;margin-left:6px">· ${esc(task.time)}</span></div></div>`).join("")}</div>`;
  const actionCard = (action: ReportContext["plan"]["priority_actions"][number]) => `<div style="background:#fff;border:1px solid #E2E8F0;border-radius:10px;padding:14px;margin-bottom:12px"><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">${badge(action.priority, action.priority === "high" ? "High" : "Critical")}<span style="font-size:11px;background:#F1F5F9;border:1px solid #E2E8F0;border-radius:999px;padding:3px 10px;color:#475569">${esc(action.difficulty)} · ${esc(action.time)}</span></div><h4 style="font-size:14px;font-weight:700;color:${COLORS.ink};margin:0 0 8px;line-height:1.35;word-break:break-word">${esc(action.title)}</h4><div style="background:#F8FAFC;border-radius:8px;padding:8px 10px;margin-bottom:8px"><p style="font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#94A3B8;margin:0 0 3px">Action</p><p style="font-size:12px;color:#334155;margin:0;line-height:1.5">${esc(action.action)}</p></div><div style="background:#F0FDF4;border-radius:8px;padding:8px 10px"><p style="font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#15803D;margin:0 0 3px">Expected Impact</p><p style="font-size:12px;color:#166534;margin:0;line-height:1.5">${esc(action.expected_impact)}</p></div></div>`;
  const actions = context.plan.priority_actions.slice(0, 3);

  return `<section class="page">${sectionLabel("Recommendations")}<h2 style="font-size:24px;font-weight:800;color:${COLORS.ink};margin:0 0 4px">Your 30-Day Plan</h2><p style="font-size:12px;color:${COLORS.muted};margin:0 0 16px">A structured action plan to improve performance, accessibility, and trust.</p><div style="display:grid;grid-template-columns:48% 52%;gap:12px"><div>${weekBox("Week 1 - Quick Wins", context.plan.week1)}${weekBox("Week 2 - Performance", context.plan.week2)}${weekBox("Weeks 3-4 - Polish", context.plan.week3_4)}</div><div><p style="font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#94A3B8;margin:0 0 6px">Priority Recommendations</p><p style="font-size:14px;font-weight:700;color:${COLORS.ink};margin:0 0 12px">Recommended next actions</p>${actions.length ? actions.map(actionCard).join("") : `<div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:16px"><p style="font-size:13px;font-weight:600;color:${COLORS.ink};margin:0 0 4px">No urgent actions queued</p><p style="font-size:11px;color:${COLORS.muted};margin:0">The highest-impact work is already reflected in the weekly plan.</p></div>`}</div></div>${footer(context, 9)}</section>`;
}

function page10(context: ReportContext) {
  const currentScore = context.plan.current_score;
  const projectedMid = Math.round((context.plan.projected_min + context.plan.projected_max) / 2);
  const lowGain = Math.max(0, context.plan.projected_min - currentScore);
  const highGain = Math.max(0, context.plan.projected_max - currentScore);
  const drivers = [
    {
      title: "Performance cleanup",
      text: context.scores.performance < 85
        ? `Reducing page weight and script delay should recover the largest share of lost points first.`
        : `Performance is already steady, so smaller delivery fixes should protect the current baseline.`
    },
    {
      title: "SEO and discovery",
      text: context.scores.seo < 85
        ? `On-page SEO cleanup should make ranking signals clearer and improve organic discovery.`
        : `Maintaining strong SEO signals should preserve rankings while the other fixes land.`
    },
    {
      title: "Trust and usability",
      text: context.scores.accessibility < 85 || context.scores.best_practices < 85
        ? `Accessibility and standards fixes should reduce trust friction and help more sessions complete cleanly.`
        : `Trust and usability are already strong, so the remaining work is about protecting that experience.`
    }
  ];

  return `<section class="page">${sectionLabel("Expected Outcome")}<h2 style="font-size:24px;font-weight:800;color:${COLORS.ink};margin:0 0 4px">Expected Outcome</h2><p style="font-size:12px;color:${COLORS.muted};margin:0 0 16px">By following the 30-day improvement plan, we project a measurable lift in overall score and visitor experience.</p><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">${card(`<div style="display:flex;align-items:center;gap:14px">${ring(currentScore, 72)}<div><p style="font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#94A3B8;margin:0 0 4px">Current Score</p><p style="font-size:28px;font-weight:800;color:${COLORS.ink};margin:0;line-height:1;white-space:nowrap">${currentScore}<span style="font-size:14px;color:${COLORS.muted}">/100</span></p><p style="font-size:11px;color:${COLORS.muted};margin:6px 0 0">Where the site is performing today.</p></div></div>`)}${card(`<div style="display:flex;align-items:center;gap:14px">${ring(projectedMid, 72)}<div><p style="font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#15803D;margin:0 0 4px">Projected Range</p><p style="font-size:28px;font-weight:800;color:#15803D;margin:0;line-height:1;white-space:nowrap">${context.plan.projected_min}-${context.plan.projected_max}<span style="font-size:14px;color:#16A34A">/100</span></p><p style="font-size:11px;color:${COLORS.muted};margin:6px 0 0">Expected range once the recommended fixes are implemented.</p></div></div>`, "background:#F0FDF4;border-color:#BBF7D0")}</div><div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:14px;margin-bottom:14px"><p style="font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#94A3B8;margin:0 0 8px">What drives this improvement</p><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">${drivers.map((driver) => `<div style="background:#fff;border:1px solid #E2E8F0;border-radius:8px;padding:12px"><p style="font-size:12px;font-weight:700;color:${COLORS.ink};margin:0 0 6px">${esc(driver.title)}</p><p style="font-size:11px;color:${COLORS.muted};margin:0;line-height:1.55">${esc(driver.text)}</p></div>`).join("")}</div></div><div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:10px;padding:14px 16px"><p style="font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#1D4ED8;margin:0 0 4px">Projected points recovered</p><p style="font-size:24px;font-weight:800;color:#1E40AF;margin:0 0 6px;line-height:1">+${lowGain} to +${highGain} points</p><p style="font-size:12px;color:#1E3A8A;margin:0;line-height:1.55">The expected gain comes from removing the highest-friction technical blockers first, then improving search clarity and usability signals.</p></div>${footer(context, 10)}</section>`;
}

function page11(context: ReportContext) {
  const vitals = context.vitals;
  const uptime = context.uptime;
  const lcpLabel = formatLcpSeconds(vitals.lcp.value);
  const lcpTone = lcpStatus(vitals.lcp.value);
  const vitalCard = (titleText: string, value: string, status: string, description: string) => card(`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><span style="font-size:12px;font-weight:700;color:${COLORS.ink}">${titleText}</span>${badge(status)}</div><p style="font-size:28px;font-weight:800;color:${COLORS.ink};margin:0 0 6px;line-height:1;white-space:nowrap">${value}</p><p style="font-size:11px;color:${COLORS.muted};margin:0;line-height:1.55">${esc(description)}</p>`);
  const crux = uptime.crux_available && uptime.loading_good !== null
    ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px">${card(`<p style="font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#94A3B8;margin:0 0 4px">Loading Performance</p><p style="font-size:13px;font-weight:700;color:${COLORS.ink};margin:0">${uptime.loading_good}% good <span style="color:${COLORS.danger}">/ ${uptime.loading_poor}% poor</span></p>`)}${card(`<p style="font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#94A3B8;margin:0 0 4px">Layout Stability</p><p style="font-size:13px;font-weight:700;color:${COLORS.ink};margin:0">${uptime.stability_good}% good <span style="color:${COLORS.danger}">/ ${uptime.stability_poor}% poor</span></p>`)}${card(`<p style="font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#94A3B8;margin:0 0 4px">Interaction Speed</p><p style="font-size:13px;font-weight:700;color:${COLORS.ink};margin:0">${uptime.interaction_good}% good <span style="color:${COLORS.danger}">/ ${uptime.interaction_poor}% poor</span></p>`)}${card(`<p style="font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#94A3B8;margin:0 0 4px">Time to First Byte</p><p style="font-size:13px;font-weight:700;color:${COLORS.ink};margin:0">${uptime.ttfb_good}% good <span style="color:${COLORS.danger}">/ ${uptime.ttfb_poor}% poor</span></p>`)}</div>`
    : `<p style="font-size:12px;color:#94A3B8;margin:12px 0 0">No data - CrUX data is not available for this origin yet.</p>`;
  const uptimeValue = uptime.status === "monitoring_active" ? "Monitoring active" : uptime.percentage !== null ? `${uptime.percentage}%` : "Pending";
  const lcpDescription = lcpTone === "good"
    ? `Your page takes ${lcpLabel} seconds to load, which is below the 2.5-second target. Fast first loads support stronger first impressions and more completed visits.`
    : lcpTone === "needs_improvement"
      ? `Your page takes ${lcpLabel} seconds to load, which is above the 2.5-second target but below 4 seconds. Improving this will reduce early abandonment before visitors reach key actions.`
      : `Your page takes ${lcpLabel} seconds to load, which exceeds 4 seconds and is well above the 2.5-second target. Slow first loads increase abandonment before visitors can act.`;

  return `<section class="page">${sectionLabel("Google's Health Checks")}<h2 style="font-size:24px;font-weight:800;color:${COLORS.ink};margin:0 0 4px">Google's Health Checks</h2><p style="font-size:12px;color:${COLORS.muted};margin:0 0 16px">Core Web Vitals and real-user performance signals.</p><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:13px;margin-bottom:12px">${vitalCard("Page Load Speed", `${lcpLabel}s`, lcpTone, lcpDescription)}${vitalCard("Click Response", `${vitals.inp.value} ms`, vitals.inp.status, vitals.inp.status === "good" ? `Your page responds to interactions in ${vitals.inp.value}ms, which is within the good range. Quick response keeps the site feeling smooth for visitors on slower devices.` : `Your page responds to interactions in ${vitals.inp.value}ms, which is above the ideal 200ms threshold. Slower interaction response makes the site feel less reliable during taps and clicks.`)}${vitalCard("Visual Stability", `${vitals.cls.value}`, vitals.cls.status, vitals.cls.status === "good" ? `Your visual stability score of ${vitals.cls.value} is within the good range, so the page stays mostly steady while loading. Stable layout reduces accidental clicks and keeps visitors focused on the page.` : `Your visual stability score of ${vitals.cls.value} shows layout shifts while the page loads. Moving elements cause accidental taps, form errors, and visible frustration.`)}</div><div style="border-left:3px solid ${esc(context.brand_color)};background:#F8FAFC;border-radius:0 8px 8px 0;padding:12px 16px;margin-bottom:16px"><p style="font-size:12px;color:#334155;margin:0;line-height:1.6">${esc(vitals.summary)}</p></div><div style="background:#fff;border:1px solid #E2E8F0;border-radius:10px;padding:14px"><h3 style="font-size:14px;font-weight:700;color:${COLORS.ink};margin:0 0 10px">Uptime &amp; Real User Data</h3><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">${card(`<p style="font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#94A3B8;margin:0 0 4px">30-Day Uptime</p><p style="font-size:20px;font-weight:800;color:${COLORS.ink};margin:0 0 4px">${uptimeValue}</p><p style="font-size:11px;color:${COLORS.muted};margin:0">${uptime.status === "monitoring_active" ? "First report ready in 7 days." : "Uptime monitoring has enough samples to report reliably."}</p>`)}${card(`<p style="font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#94A3B8;margin:0 0 4px">Recent Incidents</p><p style="font-size:28px;font-weight:800;color:${uptime.incidents === 0 ? COLORS.success : COLORS.danger};margin:0 0 4px">${uptime.incidents}</p><p style="font-size:11px;color:${COLORS.muted};margin:0">${uptime.incidents === 0 ? "No downtime incidents recorded in the latest period." : `${uptime.incidents} incident(s) recorded in the latest period.`}</p>`)}${card(`<p style="font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#94A3B8;margin:0 0 4px">Average Response Time</p><p style="font-size:20px;font-weight:800;color:${COLORS.ink};margin:0 0 4px">${uptime.avg_response_ms !== null ? `${uptime.avg_response_ms} ms` : "Pending"}</p><p style="font-size:11px;color:${COLORS.muted};margin:0">${uptime.avg_response_ms !== null ? "Average server response time from recent uptime checks." : "More uptime samples are needed before response time is stable."}</p>`)}${card(`<p style="font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#94A3B8;margin:0 0 4px">Real-User Speed</p><p style="font-size:20px;font-weight:800;color:${COLORS.ink};margin:0 0 4px">${uptime.real_user_speed_pct !== null ? `${uptime.real_user_speed_pct}% good` : "No data"}</p><p style="font-size:11px;color:${COLORS.muted};margin:0">Share of real visitors seeing good loading performance.</p>`)}</div>${crux}</div>${footer(context, 11)}</section>`;
}

function page12(context: ReportContext) {
  const deviceCard = (
    titleText: string,
    device: ReportContext["devices"]["mobile"],
    description: string
  ) => card(
    `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><h3 style="font-size:16px;font-weight:700;color:${COLORS.ink};margin:0">${titleText}</h3>${badge(device.status)}</div>${ring(device.score, 88)}<p style="font-size:13px;font-weight:700;color:${COLORS.ink};margin:0 0 6px;text-align:center">${titleText} visitor experience</p><p style="font-size:12px;color:${COLORS.muted};margin:0;text-align:center;line-height:1.55">${esc(description)}</p>`
  );

  const mobileDescription =
    context.devices.mobile.status === "critical"
      ? "Mobile visitors are facing severe friction, so this device experience should be fixed before any lower-impact cleanup work."
      : context.devices.mobile.status === "needs_attention"
        ? "Mobile visitors are encountering noticeable friction, and improving this will remove barriers for the majority of sessions."
        : context.devices.mobile.status === "good"
          ? "Mobile performance is solid, but targeted optimisation can still reduce friction on slower networks and smaller devices."
          : "Mobile performance is excellent, giving most visitors a fast and steady experience from the first interaction.";

  const desktopDescription =
    context.devices.desktop.status === "critical"
      ? "Desktop visitors are still seeing major friction, so this device class also needs direct cleanup to protect conversions."
      : context.devices.desktop.status === "needs_attention"
        ? "Desktop performance needs attention, and reducing technical friction here will improve consistency across larger screens."
        : context.devices.desktop.status === "good"
          ? "Desktop performance is good, with room for polish work that will make the experience feel more immediate and reliable."
          : "Desktop performance is excellent, which supports a fast and trustworthy experience for high-intent users.";

  return `<section class="page">${sectionLabel("Device Comparison")}<h2 style="font-size:24px;font-weight:800;color:${COLORS.ink};margin:0 0 4px">Mobile vs Desktop</h2><p style="font-size:12px;color:${COLORS.muted};margin:0 0 16px">Device-specific performance scores and the priority focus for optimisation work.</p><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">${deviceCard("Mobile", context.devices.mobile, mobileDescription)}${deviceCard("Desktop", context.devices.desktop, desktopDescription)}</div><div style="border-left:3px solid ${esc(context.brand_color)};background:#F8FAFC;border-radius:0 8px 8px 0;padding:14px 16px"><p style="font-size:13px;color:#334155;margin:0;line-height:1.6">${esc(context.devices.callout)}</p></div>${footer(context, 12)}</section>`;
}

function page13(context: ReportContext) {
  const footerNote = context.report_footer_text.trim();

  return `<section class="page" style="background:${COLORS.ink};display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center">${context.agency_logo_url ? `<img src="${esc(context.agency_logo_url)}" alt="${esc(context.agency_name)}" style="max-height:48px;max-width:180px;object-fit:contain;margin-bottom:10px;filter:brightness(0) invert(1)"/>` : ""}<h1 style="font-size:26px;font-weight:700;color:#F8FAFC;margin:0 0 30px;max-width:400px;line-height:1.3">Thank you for choosing ${esc(context.agency_name)}</h1><div style="width:100%;border-top:1px solid #1E293B;margin-bottom:24px"></div><p style="font-size:13px;color:#64748B;margin:0 0 6px">Reply-to email</p><p style="font-size:18px;font-weight:700;color:${COLORS.darkAccent};margin:0 0 30px">${esc(context.agency_email)}</p><div style="width:100%;border-top:1px solid #1E293B;margin-bottom:24px"></div><p style="font-size:13px;color:#64748B;margin:0 0 6px">Next report date</p><p style="font-size:18px;font-weight:700;color:${COLORS.darkAccent};margin:0${footerNote ? " 0 30px" : ""}">${esc(context.next_report_date)}</p>${footerNote ? `<div style="width:100%;border-top:1px solid #1E293B;margin:30px 0 20px"></div><p style="font-size:12px;line-height:1.7;color:#94A3B8;margin:0;max-width:430px">${esc(footerNote)}</p>` : ""}${footer(context, 13)}</section>`;
}

export function renderReportHtml(context: ReportContext) {
  const pages = [
    page1(context),
    page2(context),
    page3(context),
    page4(context),
    page5(context),
    page6(context),
    page7(context),
    page8(context),
    page9(context),
    page10(context),
    page11(context),
    page12(context),
    page13(context)
  ].join("\n");

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><style>*,*::before,*::after{box-sizing:border-box}html,body{margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}@page{size:A4;margin:0}.page{width:210mm;height:297mm;padding:17mm 17mm 14mm;overflow:hidden;position:relative;page-break-after:always;background:#FFFFFF}.page:last-child{page-break-after:avoid}img{display:block}p,h1,h2,h3,h4{word-break:break-word}</style></head><body>${pages}</body></html>`;
}
