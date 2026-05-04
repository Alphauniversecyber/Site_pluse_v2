import type {
  AgencyBranding,
  BrokenLinkRecord,
  ScanResult,
  SecurityHeadersRecord,
  UserProfile,
  Website
} from "@/types";
import { buildReportEmailTemplate } from "@/lib/report-email-template";
import { renderReportHtml, type ReportContext } from "@/lib/report-template";

type PreviewBrandingOptions = {
  agencyName?: string;
  brandColor?: string;
  emailFromName?: string;
  logoUrl?: string | null;
  replyToEmail?: string | null;
  agencyWebsiteUrl?: string | null;
  reportFooterText?: string | null;
};

const PREVIEW_WEBSITE: Website = {
  id: "preview-website",
  user_id: "preview-user",
  url: "https://clientwebsite.com",
  label: "Client Website",
  is_active: true,
  report_frequency: "weekly",
  extra_recipients: [],
  auto_email_reports: true,
  email_notifications: true,
  client_dashboard_enabled: true,
  competitor_urls: [],
  created_at: "2026-05-04T00:00:00.000Z",
  updated_at: "2026-05-04T00:00:00.000Z"
};

const PREVIEW_PROFILE: UserProfile = {
  id: "preview-user",
  email: "hello@trysitepulse.com",
  full_name: "SitePulse Preview",
  plan: "agency",
  paddle_customer_id: null,
  paddle_subscription_id: null,
  billing_cycle: "monthly",
  subscription_price: null,
  subscription_status: null,
  next_billing_date: null,
  last_payment_date: null,
  trial_end_date: null,
  trial_ends_at: null,
  is_trial: false,
  email_report_frequency: "weekly",
  email_reports_enabled: true,
  email_notifications_enabled: true,
  profile_photo_url: null,
  extra_report_recipients: [],
  created_at: "2026-05-04T00:00:00.000Z"
};

const PREVIEW_SCAN: ScanResult = {
  id: "preview-scan-current",
  website_id: PREVIEW_WEBSITE.id,
  performance_score: 91,
  seo_score: 85,
  accessibility_score: 72,
  best_practices_score: 88,
  lcp: 3.1,
  fid: 118,
  cls: 0.08,
  tbt: 140,
  issues: [
    {
      id: "issue-lcp",
      title: "Largest Contentful Paint element",
      description: "The main content takes 3.1s to load on the homepage, which is above the recommended threshold.",
      severity: "high",
      scoreImpact: 10,
      metric: "lcp",
      device: "mobile"
    },
    {
      id: "issue-meta",
      title: "Meta descriptions",
      description: "4 pages have duplicate meta descriptions, making search results less clear and less compelling.",
      severity: "medium",
      scoreImpact: 6,
      metric: "seo",
      device: "mobile"
    },
    {
      id: "issue-alt",
      title: "Image elements do not have [alt] attributes",
      description: "6 important images are missing alt text, which reduces accessibility and weakens content context.",
      severity: "low",
      scoreImpact: 4,
      metric: "accessibility",
      device: "mobile"
    }
  ],
  recommendations: [],
  raw_data: {},
  mobile_snapshot: {
    strategy: "mobile",
    performance_score: 91,
    seo_score: 85,
    accessibility_score: 72,
    best_practices_score: 88,
    lcp: 3.1,
    fid: 118,
    cls: 0.08,
    tbt: 140
  },
  desktop_snapshot: {
    strategy: "desktop",
    performance_score: 96,
    seo_score: 89,
    accessibility_score: 80,
    best_practices_score: 92,
    lcp: 1.8,
    fid: 60,
    cls: 0.03,
    tbt: 90
  },
  scan_status: "success",
  error_message: null,
  scanned_at: "2026-05-04T08:30:00.000Z"
};

const PREVIEW_PREVIOUS_SCAN: ScanResult = {
  ...PREVIEW_SCAN,
  id: "preview-scan-previous",
  performance_score: 88,
  seo_score: 82,
  accessibility_score: 70,
  best_practices_score: 84,
  scanned_at: "2026-04-27T08:30:00.000Z"
};

const PREVIEW_SECURITY_HEADERS: SecurityHeadersRecord = {
  id: "preview-security",
  website_id: PREVIEW_WEBSITE.id,
  hsts: true,
  hsts_value: "max-age=31536000; includeSubDomains",
  csp: false,
  csp_value: null,
  x_frame_options: true,
  x_frame_options_value: "SAMEORIGIN",
  x_content_type: true,
  x_content_type_value: "nosniff",
  referrer_policy: true,
  referrer_policy_value: "strict-origin-when-cross-origin",
  permissions_policy: false,
  permissions_policy_value: null,
  grade: "B",
  checked_at: "2026-05-04T08:30:00.000Z"
};

const PREVIEW_BROKEN_LINKS: BrokenLinkRecord = {
  id: "preview-links",
  website_id: PREVIEW_WEBSITE.id,
  scan_id: PREVIEW_SCAN.id,
  total_links: 146,
  working_links: 146,
  broken_links: 0,
  redirect_chains: 0,
  broken_urls: [],
  redirect_urls: [],
  scanned_at: "2026-05-04T08:30:00.000Z"
};

const PREVIEW_REPORT_CONTEXT: ReportContext = {
  white_label: true,
  agency_name: "SitePulse Studio",
  agency_logo_url: "",
  agency_email: "reports@trysitepulse.com",
  agency_website_url: "https://trysitepulse.com",
  report_footer_text: "Automated reporting built for proactive client retention.",
  brand_color: "#2563EB",
  client_name: "Client Website",
  website_url: "https://clientwebsite.com",
  report_date: "May 4, 2026",
  next_report_date: "May 11, 2026",
  health_score: 84,
  scores: {
    performance: 91,
    seo: 85,
    accessibility: 72,
    best_practices: 88
  },
  deltas: {
    performance: 3,
    seo: 3,
    accessibility: 2,
    best_practices: 4,
    is_baseline: false
  },
  industry_score: 79,
  seo_audit: {
    title_tag: {
      value: "Client Website | Growth-focused digital experience",
      chars: 52,
      status: "pass"
    },
    meta_description: {
      value: "Client Website helps visitors understand services quickly and convert with confidence.",
      chars: 90,
      status: "pass"
    },
    heading_structure: {
      h1: 1,
      h2: 6,
      h3: 8,
      status: "pass"
    },
    images_missing_alt: 6,
    open_graph: {
      status: "complete"
    },
    canonical: {
      status: "self_referencing"
    },
    action_chips: ["Add alt text to images", "Tighten meta descriptions"]
  },
  link_health: {
    total_links: 146,
    broken_links: 0,
    redirect_chains: 0
  },
  security: {
    ssl_status: "healthy",
    ssl_days_until_expiry: 142,
    ssl_authority: "Let's Encrypt",
    headers_grade: "B",
    headers_present: 4,
    health_score: 82,
    headers: {
      hsts: {
        value: "max-age=31536000; includeSubDomains",
        status: "pass"
      },
      content_security_policy: {
        value: null,
        status: "fail"
      },
      x_frame_options: {
        value: "SAMEORIGIN",
        status: "pass"
      },
      referrer_policy: {
        value: "strict-origin-when-cross-origin",
        status: "pass"
      },
      permissions_policy: {
        value: null,
        status: "fail"
      },
      x_content_type_options: {
        value: "nosniff",
        status: "pass"
      }
    }
  },
  issues: [
    {
      priority: "high",
      title: "Your main content loads slowly",
      estimated_time: "45-60 mins",
      difficulty: "medium",
      what_is_happening: "The homepage LCP is 3.1 seconds, so the main hero content appears later than ideal.",
      why_it_matters: "Slower first impressions increase abandonment before visitors reach your offer or CTA.",
      root_cause: "Large hero media and render-blocking assets are delaying the biggest on-screen element.",
      how_to_fix: "Compress the hero asset, preload the LCP image, and defer non-critical scripts."
    },
    {
      priority: "medium",
      title: "Search engines struggle to understand key pages",
      estimated_time: "20-30 mins",
      difficulty: "easy",
      what_is_happening: "Several pages reuse the same meta descriptions.",
      why_it_matters: "Duplicate metadata weakens search clarity and can lower click-through from results pages.",
      root_cause: "The CMS is reusing template copy instead of unique page-level descriptions.",
      how_to_fix: "Write unique meta descriptions for the highest-value service and landing pages first."
    },
    {
      priority: "medium",
      title: "Some images are missing descriptions",
      estimated_time: "15-20 mins",
      difficulty: "easy",
      what_is_happening: "Six important images are missing descriptive alt text.",
      why_it_matters: "Missing descriptions create accessibility friction and reduce content context for assistive tools.",
      root_cause: "Image uploads were published without complete accessibility fields.",
      how_to_fix: "Add concise alt text that explains each image's purpose on the page."
    }
  ],
  business_impact: {
    traffic: "SEO score is 85/100, so visibility is solid but clearer metadata should still improve discovery on high-intent pages.",
    conversions: "Performance score is 91/100, but the remaining LCP delay still adds friction at the most important first impression moment.",
    engagement: "Accessibility is 72/100, so a few structural fixes should make the site easier to use and more trustworthy.",
    callout: "This site is close to excellent. Focus on first-load speed and accessibility cleanup to protect conversions and retention."
  },
  plan: {
    week1: {
      goal: "Remove the most visible user friction first.",
      tasks: [
        { label: "Optimize the homepage hero media", time: "45 mins" },
        { label: "Preload the primary hero image", time: "15 mins" }
      ]
    },
    week2: {
      goal: "Improve search clarity on the most valuable pages.",
      tasks: [
        { label: "Rewrite duplicate meta descriptions", time: "30 mins" },
        { label: "Review title/meta pairings for service pages", time: "20 mins" }
      ]
    },
    week3_4: {
      goal: "Tighten accessibility and trust details.",
      tasks: [
        { label: "Add missing image alt text", time: "20 mins" },
        { label: "Audit remaining accessibility warnings", time: "40 mins" }
      ]
    },
    priority_actions: [
      {
        priority: "high",
        difficulty: "Medium",
        time: "45-60 mins",
        title: "Improve the homepage LCP",
        action: "Reduce the size and render cost of the largest above-the-fold element.",
        expected_impact: "A faster first impression and less drop-off on high-intent visits."
      },
      {
        priority: "high",
        difficulty: "Easy",
        time: "20-30 mins",
        title: "Refresh duplicate meta descriptions",
        action: "Write distinct meta descriptions for the main service and conversion pages.",
        expected_impact: "Stronger click-through from search and clearer page positioning."
      }
    ],
    current_score: 84,
    projected_min: 88,
    projected_max: 92
  },
  vitals: {
    lcp: {
      value: 3.1,
      status: "needs_improvement"
    },
    inp: {
      value: 118,
      status: "good"
    },
    cls: {
      value: 0.08,
      status: "good"
    },
    summary: "The site is generally fast, but the first visible content still appears later than ideal on the homepage."
  },
  uptime: {
    status: "data_available",
    percentage: 99.96,
    incidents: 0,
    avg_response_ms: 318,
    crux_available: true,
    real_user_speed_pct: 82,
    loading_good: 82,
    loading_poor: 6,
    stability_good: 95,
    stability_poor: 1,
    interaction_good: 94,
    interaction_poor: 2,
    ttfb_good: 79,
    ttfb_poor: 7
  },
  devices: {
    mobile: {
      score: 91,
      status: "excellent"
    },
    desktop: {
      score: 96,
      status: "excellent"
    },
    callout: "Mobile and desktop are both strong, so the best gains will come from the shared homepage speed fixes."
  }
};

function buildPreviewBranding(options: PreviewBrandingOptions = {}): AgencyBranding {
  return {
    id: "preview-branding",
    user_id: PREVIEW_PROFILE.id,
    agency_name: options.agencyName?.trim() || "SitePulse Studio",
    logo_url: options.logoUrl ?? null,
    brand_color: options.brandColor || "#2563EB",
    email_from_name: options.emailFromName?.trim() || options.agencyName?.trim() || "SitePulse Studio",
    reply_to_email: options.replyToEmail?.trim() || "reports@trysitepulse.com",
    agency_website_url: options.agencyWebsiteUrl?.trim() || "https://trysitepulse.com",
    report_footer_text:
      options.reportFooterText?.trim() || "Automated reporting built for proactive client retention.",
    created_at: "2026-05-04T00:00:00.000Z"
  };
}

export function buildPreviewEmailHtml(options: PreviewBrandingOptions = {}) {
  return buildReportEmailTemplate({
    to: "client@clientwebsite.com",
    website: PREVIEW_WEBSITE,
    profile: PREVIEW_PROFILE,
    branding: buildPreviewBranding(options),
    scan: PREVIEW_SCAN,
    previousScan: PREVIEW_PREVIOUS_SCAN,
    securityHeaders: PREVIEW_SECURITY_HEADERS,
    brokenLinks: PREVIEW_BROKEN_LINKS,
    dashboardUrl: "https://app.trysitepulse.com/d/clientwebsite-preview",
    deliveryMode: "scheduled",
    frequency: "weekly",
    baseUrl: "https://app.trysitepulse.com"
  }).html;
}

export function buildPreviewReportHtml(options: PreviewBrandingOptions = {}) {
  const branding = buildPreviewBranding(options);

  return renderReportHtml({
    ...PREVIEW_REPORT_CONTEXT,
    agency_name: branding.agency_name,
    agency_logo_url: branding.logo_url ?? "",
    agency_email: branding.reply_to_email?.trim() || "reports@trysitepulse.com",
    agency_website_url: branding.agency_website_url?.trim() || "",
    report_footer_text: branding.report_footer_text?.trim() || "",
    brand_color: branding.brand_color
  });
}
