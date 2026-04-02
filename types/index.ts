export type PlanKey = "free" | "starter" | "agency";
export type ScanFrequency = "daily" | "weekly" | "monthly";
export type Severity = "low" | "medium" | "high";
export type NotificationType = "score_drop" | "critical_score" | "scan_failure" | "report_ready";

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  plan: PlanKey;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  email_report_frequency: ScanFrequency;
  email_reports_enabled: boolean;
  email_notifications_enabled: boolean;
  profile_photo_url: string | null;
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
  created_at: string;
  latest_scan?: ScanResult | null;
  schedule?: ScanSchedule | null;
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

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}
