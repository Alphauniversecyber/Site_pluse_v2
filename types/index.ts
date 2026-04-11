export type PlanKey = "free" | "starter" | "agency";
export type BillingCycle = "monthly" | "yearly";
export type ScanFrequency = "daily" | "weekly" | "monthly";
export type Severity = "low" | "medium" | "high";
export type SubscriptionStatus =
  | "inactive"
  | "approval_pending"
  | "trialing"
  | "active"
  | "cancelled"
  | "suspended"
  | "payment_denied";
export type NotificationType =
  | "score_drop"
  | "critical_score"
  | "scan_failure"
  | "report_ready"
  | "accessibility_regression"
  | "ssl_expiry"
  | "uptime_alert"
  | "competitor_alert"
  | "broken_links_alert";
export type PlainLanguageCategory = "Performance" | "SEO" | "Accessibility" | "Security";
export type PlainLanguageDifficulty = "Easy" | "Medium" | "Complex";
export type UptimeStatus = "up" | "down";
export type UptimeSource = "vercel" | "uptimerobot";

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  plan: PlanKey;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  paypal_subscription_id: string | null;
  paypal_plan_id: string | null;
  paypal_payer_id: string | null;
  billing_cycle: BillingCycle | null;
  subscription_price: number | null;
  subscription_status: SubscriptionStatus | null;
  next_billing_date: string | null;
  trial_end_date: string | null;
  email_report_frequency: ScanFrequency;
  email_reports_enabled: boolean;
  email_notifications_enabled: boolean;
  profile_photo_url: string | null;
  uptimerobot_api_key?: string | null;
  extra_report_recipients: string[];
  created_at: string;
}

export interface Website {
  id: string;
  user_id: string;
  url: string;
  label: string;
  is_active: boolean;
  email_reports_enabled?: boolean;
  report_recipients?: string[];
  competitor_urls?: string[];
  created_at: string;
  updated_at?: string;
  magic_token?: string | null;
  gsc_access_token?: string | null;
  gsc_refresh_token?: string | null;
  gsc_property?: string | null;
  gsc_connected_at?: string | null;
  ga_access_token?: string | null;
  ga_refresh_token?: string | null;
  ga_property_id?: string | null;
  ga_connected_at?: string | null;
  health_score?: WebsiteHealthScore | null;
  latest_scan?: ScanResult | null;
  schedule?: ScanSchedule | null;
  seo_audit?: SeoAuditRecord | null;
  ssl_check?: SslCheckRecord | null;
  security_headers?: SecurityHeadersRecord | null;
  crux_data?: CruxDataRecord | null;
  broken_links?: BrokenLinkRecord | null;
  uptime_checks?: UptimeCheckRecord[];
  competitor_scans?: CompetitorScanRecord[];
}

export interface AgencyBranding {
  id: string;
  user_id: string;
  agency_name: string;
  logo_url: string | null;
  brand_color: string;
  email_from_name: string | null;
  created_at: string;
}

export interface ScanIssue {
  id: string;
  title: string;
  description: string;
  severity: Severity;
  scoreImpact?: number | null;
  metric?: string | null;
  device?: "mobile" | "desktop";
}

export interface ScanRecommendation {
  id: string;
  title: string;
  description: string;
  priority: Severity;
  potentialSavingsMs?: number | null;
  link?: string | null;
  device?: "mobile" | "desktop";
}

export interface DeviceAuditSummary {
  strategy: "mobile" | "desktop";
  performance_score: number;
  seo_score: number;
  accessibility_score: number;
  best_practices_score: number;
  lcp: number | null;
  fid: number | null;
  cls: number | null;
  tbt: number | null;
}

export interface ScanResult {
  id: string;
  website_id: string;
  performance_score: number;
  seo_score: number;
  accessibility_score: number;
  best_practices_score: number;
  lcp: number | null;
  fid: number | null;
  cls: number | null;
  tbt: number | null;
  issues: ScanIssue[];
  recommendations: ScanRecommendation[];
  accessibility_violations?: Array<Record<string, unknown>>;
  raw_data: Record<string, unknown>;
  mobile_snapshot?: DeviceAuditSummary;
  desktop_snapshot?: DeviceAuditSummary;
  scan_status?: "success" | "failed";
  error_message?: string | null;
  scanned_at: string;
}

export interface Report {
  id: string;
  website_id: string;
  scan_id: string;
  pdf_url: string;
  sent_to_email: string | null;
  sent_at: string | null;
  created_at?: string;
  website?: Website;
  scan?: ScanResult;
}

export interface ReportAiCacheEntry {
  id: string;
  owner_user_id: string;
  website_id: string;
  scan_id: string;
  cache_key: string;
  section: string;
  provider: "groq" | "gemini" | "template";
  payload: Record<string, unknown>;
  expires_at: string;
  created_at: string;
  updated_at?: string;
}

export interface PreviewScanIssue {
  id: string;
  title: string;
  summary: string;
  why_it_matters: string;
}

export interface PreviewScanResult {
  session_id: string;
  normalized_url: string;
  website_label: string;
  overall_score: number;
  scores: {
    performance: number;
    seo: number;
    accessibility: number;
    best_practices: number;
  };
  impact_message: string;
  improvement_message: string;
  unlock_path: string;
  issues: PreviewScanIssue[];
  generated_at: string;
}

export interface PreviewScanPayload {
  performance_score: number;
  seo_score: number;
  accessibility_score: number;
  best_practices_score: number;
  lcp: number | null;
  fid: number | null;
  cls: number | null;
  tbt: number | null;
  issues: ScanIssue[];
  recommendations: ScanRecommendation[];
  accessibility_violations: Array<Record<string, unknown>>;
  raw_data: Record<string, unknown>;
  mobile_snapshot?: DeviceAuditSummary;
  desktop_snapshot?: DeviceAuditSummary;
  scan_status: "success" | "failed";
  error_message?: string | null;
}

export interface PreviewScanSessionRecord {
  id: string;
  input_url: string;
  normalized_url: string;
  website_label: string;
  preview_payload: PreviewScanResult;
  scan_payload: PreviewScanPayload;
  expires_at: string;
  claimed_by_user_id: string | null;
  claimed_website_id: string | null;
  claimed_scan_id: string | null;
  created_at: string;
}

export interface PlainLanguageIssue {
  id: string;
  title: string;
  whats_happening: string;
  business_impact: string;
  how_to_fix: string;
  severity: Severity;
  difficulty: PlainLanguageDifficulty;
  time_estimate: string;
  category: PlainLanguageCategory;
}

export interface PlainLanguageRecommendation {
  title: string;
  description: string;
  difficulty: PlainLanguageDifficulty;
  time_estimate: string;
  priority: Severity;
}

export interface PlainLanguageRawIssue {
  id: string;
  title: string;
  description: string;
  severity: Severity;
  device: "mobile" | "desktop" | "both" | null;
}

export interface PlainLanguageRawRecommendation {
  id: string;
  title: string;
  description: string;
  priority: Severity;
  device: "mobile" | "desktop" | "both" | null;
}

export interface WebsiteScanPlainEnglish {
  provider: "groq" | "gemini" | "template";
  summary: string;
  severity_counts: {
    high: number;
    medium: number;
    low: number;
  };
  issues: PlainLanguageIssue[];
  recommendations: PlainLanguageRecommendation[];
  raw_issues: PlainLanguageRawIssue[];
  raw_recommendations: PlainLanguageRawRecommendation[];
}

export interface ScanSchedule {
  id: string;
  website_id: string;
  frequency: ScanFrequency;
  next_scan_at: string | null;
  last_scan_at: string | null;
}

export interface NotificationItem {
  id: string;
  user_id: string;
  website_id: string | null;
  type: NotificationType;
  title: string;
  body: string;
  is_read: boolean;
  severity: Severity;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface TeamMember {
  id: string;
  owner_user_id: string;
  member_email: string;
  member_user_id: string | null;
  role: "owner" | "admin" | "viewer";
  status: "invited" | "active";
  invited_at: string;
}

export interface DashboardOverview {
  totalWebsites: number;
  averagePerformance: number;
  scansThisMonth: number;
  criticalSites: number;
}

export interface SeoTagCheck {
  exists: boolean;
  count?: number;
  length?: number;
  status: string;
  value?: string | null;
}

export interface SeoHeadingAudit {
  h1_count: number;
  h2_count: number;
  h3_count: number;
  status: string;
  outline: Array<{
    level: "h1" | "h2" | "h3";
    text: string;
  }>;
}

export interface SeoSocialAudit {
  title: boolean;
  description: boolean;
  image?: boolean;
  card?: boolean;
}

export interface SeoCanonicalAudit {
  exists: boolean;
  href?: string | null;
  self_referencing: boolean;
  status: string;
}

export interface SeoAuditRecord {
  id: string;
  website_id: string;
  scan_id: string;
  title_tag: SeoTagCheck;
  meta_description: SeoTagCheck;
  headings: SeoHeadingAudit;
  images_missing_alt: number;
  images_missing_alt_urls: string[];
  og_tags: SeoSocialAudit;
  twitter_tags: SeoSocialAudit;
  canonical: SeoCanonicalAudit;
  schema_present: boolean;
  schema_types: string[];
  fix_suggestions: Array<{
    title: string;
    severity: Severity;
    description: string;
  }>;
  created_at: string;
}

export interface BrokenLinkRecord {
  id: string;
  website_id: string;
  scan_id: string | null;
  total_links: number;
  working_links: number;
  broken_links: number;
  redirect_chains: number;
  broken_urls: Array<{
    url: string;
    parent_url?: string | null;
    status: number;
  }>;
  redirect_urls: Array<{
    url: string;
    parent_url?: string | null;
    status: number;
    redirected_to?: string | null;
  }>;
  scanned_at: string;
}

export interface SslCheckRecord {
  id: string;
  website_id: string;
  is_valid: boolean;
  expiry_date: string | null;
  days_until_expiry: number | null;
  issuer: string | null;
  grade: "green" | "orange" | "red" | "critical";
  checked_at: string;
}

export interface SecurityHeadersRecord {
  id: string;
  website_id: string;
  hsts: boolean;
  hsts_value: string | null;
  csp: boolean;
  csp_value: string | null;
  x_frame_options: boolean;
  x_frame_options_value: string | null;
  x_content_type: boolean;
  x_content_type_value: string | null;
  referrer_policy: boolean;
  referrer_policy_value: string | null;
  permissions_policy: boolean;
  permissions_policy_value: string | null;
  grade: "A" | "B" | "C" | "F";
  checked_at: string;
}

export interface UptimeCheckRecord {
  id: string;
  website_id: string;
  checked_at: string;
  status: UptimeStatus;
  response_time_ms: number | null;
  source: UptimeSource;
  incident_reason: string | null;
  raw_payload: Record<string, unknown>;
}

export interface CruxMetricDistribution {
  good: number;
  needs_improvement: number;
  poor: number;
}

export interface CruxDataRecord {
  id: string;
  website_id: string;
  lcp_good_pct: number;
  lcp_needs_pct: number;
  lcp_poor_pct: number;
  cls_good_pct: number;
  cls_needs_pct: number;
  cls_poor_pct: number;
  inp_good_pct: number;
  inp_needs_pct: number;
  inp_poor_pct: number;
  fcp_good_pct: number;
  fcp_needs_pct: number;
  fcp_poor_pct: number;
  ttfb_good_pct: number;
  ttfb_needs_pct: number;
  ttfb_poor_pct: number;
  raw_payload: Record<string, unknown>;
  fetched_at: string;
}

export interface CompetitorScanRecord {
  id: string;
  website_id: string;
  competitor_url: string;
  performance: number;
  seo: number;
  accessibility: number;
  best_practices: number;
  scan_status: "success" | "failed";
  error_message: string | null;
  scanned_at: string;
}

export type DashboardDataSource = "live" | "mock";
export type ClientDashboardSeverity = "critical" | "warning" | "info";
export type ClientDashboardPriority = "high" | "medium" | "low";

export interface GscDailyPoint {
  date: string;
  label: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GscTopQuery {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GscSitemapRecord {
  path: string;
  submitted: number;
  errors: number;
  warnings: number;
  healthy: boolean;
}

export interface GscDashboardData {
  connected: boolean;
  source: DashboardDataSource;
  property: string | null;
  lastSyncedAt: string | null;
  summary: {
    clicks: number;
    impressions: number;
    avgPosition: number;
    indexedPages: number;
    sitemapSubmitted: number;
    ctr: number;
  };
  comparison: {
    clicks: number;
    impressions: number;
    avgPosition: number;
    indexedPages: number;
  };
  daily: GscDailyPoint[];
  topQueries: GscTopQuery[];
  sitemaps: GscSitemapRecord[];
}

export interface GaDailyPoint {
  date: string;
  label: string;
  sessions: number;
  bounceRate: number;
}

export interface GaTopPage {
  page: string;
  sessions: number;
  bounceRate: number;
}

export interface DeviceBreakdownPoint {
  device: string;
  sessions: number;
  share: number;
}

export interface CountryBreakdownPoint {
  country: string;
  sessions: number;
}

export interface GaDashboardData {
  connected: boolean;
  source: DashboardDataSource;
  propertyId: string | null;
  lastSyncedAt: string | null;
  summary: {
    sessions: number;
    bounceRate: number;
  };
  comparison: {
    sessions: number;
    bounceRate: number;
  };
  daily: GaDailyPoint[];
  sparkline: number[];
  topPages: GaTopPage[];
  devices: DeviceBreakdownPoint[];
  countries: CountryBreakdownPoint[];
}

export interface ClientDashboardIssue {
  id: string;
  severity: ClientDashboardSeverity;
  title: string;
  description: string;
  affectedPages: number;
  urls: string[];
}

export interface ClientDashboardRecommendation {
  id: string;
  priority: ClientDashboardPriority;
  title: string;
  action: string;
  impact: string;
}

export interface ClientDashboardPayload {
  token: string;
  clientName: string;
  website: {
    id: string;
    url: string;
    label: string;
  };
  lastUpdated: string;
  healthScore: number;
  statusLabel: "NEEDS ATTENTION" | "GOOD" | "EXCELLENT";
  connections: {
    gsc: boolean;
    ga: boolean;
  };
  gsc: GscDashboardData;
  ga: GaDashboardData;
  issues: ClientDashboardIssue[];
  recommendations: ClientDashboardRecommendation[];
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

export interface WebsiteHealthScore {
  overall: number;
  breakdown: {
    performance: number;
    seo: number;
    security: number;
    uptime: number;
    accessibility: number;
  };
}
