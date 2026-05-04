create extension if not exists "pgcrypto";

do $$
begin
  if not exists (select 1 from pg_type where typname = 'plan_tier') then
    create type public.plan_tier as enum ('free', 'starter', 'agency');
  end if;

  if not exists (select 1 from pg_type where typname = 'scan_frequency') then
    create type public.scan_frequency as enum ('daily', 'weekly', 'monthly');
  end if;

  if not exists (select 1 from pg_type where typname = 'scan_status') then
    create type public.scan_status as enum ('success', 'failed');
  end if;

  if not exists (select 1 from pg_type where typname = 'severity_level') then
    create type public.severity_level as enum ('low', 'medium', 'high');
  end if;

  if not exists (select 1 from pg_type where typname = 'billing_cycle') then
    create type public.billing_cycle as enum ('monthly', 'yearly');
  end if;

  if not exists (select 1 from pg_type where typname = 'subscription_status') then
    create type public.subscription_status as enum (
      'inactive',
      'approval_pending',
      'trialing',
      'active',
      'cancelled',
      'suspended',
      'payment_denied'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'notification_type') then
    create type public.notification_type as enum ('score_drop', 'critical_score', 'scan_failure', 'report_ready', 'accessibility_regression');
  end if;

  if not exists (select 1 from pg_type where typname = 'uptime_status') then
    create type public.uptime_status as enum ('up', 'down');
  end if;

  if not exists (select 1 from pg_type where typname = 'uptime_source') then
    create type public.uptime_source as enum ('vercel', 'uptimerobot');
  end if;

  if not exists (select 1 from pg_type where typname = 'team_role') then
    create type public.team_role as enum ('owner', 'admin', 'viewer');
  end if;

  if not exists (select 1 from pg_type where typname = 'team_status') then
    create type public.team_status as enum ('invited', 'active');
  end if;
end $$;

alter type public.notification_type add value if not exists 'ssl_expiry';
alter type public.notification_type add value if not exists 'uptime_alert';
alter type public.notification_type add value if not exists 'competitor_alert';
alter type public.notification_type add value if not exists 'broken_links_alert';
alter type public.subscription_status add value if not exists 'paused';
alter type public.subscription_status add value if not exists 'past_due';
alter type public.subscription_status add value if not exists 'payment_failed';

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  full_name text,
  plan public.plan_tier not null default 'free',
  plan_override boolean not null default false,
  plan_override_counts_as_revenue boolean not null default false,
  timezone text not null default 'UTC',
  paddle_customer_id text,
  paddle_subscription_id text,
  billing_cycle public.billing_cycle,
  subscription_price integer,
  subscription_status public.subscription_status default 'inactive',
  next_billing_date timestamptz,
  last_payment_date timestamptz,
  trial_end_date timestamptz,
  trial_ends_at timestamptz,
  is_trial boolean not null default false,
  email_report_frequency public.scan_frequency not null default 'weekly',
  email_reports_enabled boolean not null default false,
  email_notifications_enabled boolean not null default false,
  profile_photo_url text,
  uptimerobot_api_key text,
  extra_report_recipients text[] not null default '{}'::text[],
  ip_address text,
  country text,
  city text,
  region text,
  located_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.sent_lifecycle_emails (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  email_type text not null,
  sent_at timestamptz not null default timezone('utc', now()),
  unique (user_id, email_type)
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  email text not null,
  plan_name text not null,
  plan_tier public.plan_tier not null,
  billing_interval public.billing_cycle not null,
  original_price numeric(10,2) not null,
  sale_price numeric(10,2) not null,
  paddle_customer_id text,
  paddle_subscription_id text not null unique,
  status public.subscription_status not null default 'inactive',
  next_billing_date timestamptz,
  last_payment_date timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.billing_plan_prices (
  id uuid primary key default gen_random_uuid(),
  plan_key public.plan_tier not null,
  billing_cycle public.billing_cycle not null,
  original_price numeric(10,2) not null check (original_price >= 0),
  sale_price numeric(10,2) not null check (sale_price >= 0 and sale_price <= original_price),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (plan_key, billing_cycle)
);

insert into public.billing_plan_prices (plan_key, billing_cycle, original_price, sale_price)
values
  ('starter', 'monthly', 49, 19),
  ('starter', 'yearly', 468, 187),
  ('agency', 'monthly', 149, 59),
  ('agency', 'yearly', 1428, 571)
on conflict (plan_key, billing_cycle) do nothing;

create table if not exists public.payment_logs (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid references public.subscriptions (id) on delete set null,
  user_id uuid references public.users (id) on delete set null,
  user_email text not null,
  plan_name text,
  event_type text not null,
  status text not null,
  error_message text,
  amount numeric(10,2),
  paddle_event_id text,
  paddle_subscription_id text,
  metadata jsonb not null default '{}'::jsonb,
  timestamp timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.manual_revenue_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  plan text not null,
  amount numeric(10,2) not null check (amount >= 0),
  note text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.paddle_webhook_events (
  id uuid primary key default gen_random_uuid(),
  paddle_event_id text not null unique,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  retry_count integer not null default 0,
  next_retry_at timestamptz not null default timezone('utc', now()),
  processed_at timestamptz,
  last_error text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.agency_branding (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users (id) on delete cascade,
  agency_name text not null,
  logo_url text,
  brand_color text not null default '#3B82F6',
  email_from_name text,
  reply_to_email text,
  agency_website_url text,
  report_footer_text text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  subject text not null,
  message text not null,
  status text not null default 'unread',
  admin_reply text,
  replied_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  user_id uuid references auth.users (id) on delete set null
);

create index if not exists contact_messages_email_created_at_idx
  on public.contact_messages (email, created_at desc);

create index if not exists contact_messages_status_created_at_idx
  on public.contact_messages (status, created_at desc);

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.users (id) on delete cascade,
  member_email text not null,
  member_user_id uuid references public.users (id) on delete set null,
  role public.team_role not null default 'viewer',
  status public.team_status not null default 'invited',
  invited_at timestamptz not null default timezone('utc', now()),
  joined_at timestamptz,
  unique (owner_user_id, member_email)
);

create table if not exists public.team_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_owner_id uuid not null references public.users (id) on delete cascade,
  invited_email text not null,
  role text not null check (role in ('viewer', 'admin')),
  token uuid not null unique,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default timezone('utc', now()),
  accepted_at timestamptz
);

create table if not exists public.websites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  url text not null,
  label text not null,
  is_active boolean not null default true,
  report_frequency text not null default 'weekly' check (report_frequency in ('daily', 'weekly', 'monthly', 'never')),
  extra_recipients text[] not null default '{}'::text[],
  auto_email_reports boolean not null default true,
  email_notifications boolean not null default true,
  client_dashboard_enabled boolean not null default false,
  client_dashboard_use_branding_logo boolean not null default true,
  competitor_urls jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, url)
);

create table if not exists public.scan_results (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references public.websites (id) on delete cascade,
  performance_score integer not null check (performance_score >= 0 and performance_score <= 100),
  seo_score integer not null check (seo_score >= 0 and seo_score <= 100),
  accessibility_score integer not null check (accessibility_score >= 0 and accessibility_score <= 100),
  best_practices_score integer not null check (best_practices_score >= 0 and best_practices_score <= 100),
  lcp double precision,
  fid double precision,
  cls double precision,
  tbt double precision,
  issues jsonb not null default '[]'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  accessibility_violations jsonb not null default '[]'::jsonb,
  raw_data jsonb not null default '{}'::jsonb,
  mobile_snapshot jsonb not null default '{}'::jsonb,
  desktop_snapshot jsonb not null default '{}'::jsonb,
  scan_status public.scan_status not null default 'success',
  error_message text,
  scanned_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references public.websites (id) on delete cascade,
  scan_id uuid not null references public.scan_results (id) on delete cascade,
  pdf_url text not null,
  sent_to_email text,
  sent_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.report_ai_cache (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.users (id) on delete cascade,
  website_id uuid not null references public.websites (id) on delete cascade,
  scan_id uuid not null references public.scan_results (id) on delete cascade,
  cache_key text not null unique,
  section text not null,
  provider text not null check (provider in ('groq', 'gemini', 'template')),
  payload jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.preview_scan_sessions (
  id uuid primary key default gen_random_uuid(),
  input_url text not null,
  normalized_url text not null,
  website_label text not null,
  preview_payload jsonb not null default '{}'::jsonb,
  scan_payload jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null,
  claimed_by_user_id uuid references public.users (id) on delete set null,
  claimed_website_id uuid references public.websites (id) on delete set null,
  claimed_scan_id uuid references public.scan_results (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.scan_schedules (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null unique references public.websites (id) on delete cascade,
  frequency public.scan_frequency not null default 'weekly',
  next_scan_at timestamptz,
  last_scan_at timestamptz
);

create table if not exists public.job_queue (
  id uuid primary key default gen_random_uuid(),
  job_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'processing', 'done', 'failed')),
  created_at timestamptz not null default timezone('utc', now()),
  processed_at timestamptz
);

create table if not exists public.report_generation_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  website_id uuid not null references public.websites (id) on delete cascade,
  report_id uuid references public.reports (id) on delete set null,
  scan_id uuid references public.scan_results (id) on delete set null,
  frequency public.scan_frequency not null,
  timezone text not null default 'UTC',
  period_key text not null,
  dedupe_key text not null unique,
  scheduled_for timestamptz not null default timezone('utc', now()),
  next_attempt_at timestamptz not null default timezone('utc', now()),
  attempt_count integer not null default 0,
  status text not null default 'pending',
  failure_reason text,
  last_error text,
  last_attempt_at timestamptz,
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.report_email_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  website_id uuid not null references public.websites (id) on delete cascade,
  report_id uuid references public.reports (id) on delete set null,
  frequency public.scan_frequency not null,
  timezone text not null default 'UTC',
  period_key text not null,
  dedupe_key text not null unique,
  scheduled_for timestamptz not null default timezone('utc', now()),
  next_attempt_at timestamptz not null default timezone('utc', now()),
  attempt_count integer not null default 0,
  status text not null default 'pending',
  failure_reason text,
  last_error text,
  last_attempt_at timestamptz,
  sent_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.scan_job_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  website_id uuid not null references public.websites (id) on delete cascade,
  scan_result_id uuid references public.scan_results (id) on delete set null,
  frequency public.scan_frequency not null,
  timezone text not null default 'UTC',
  period_key text not null,
  dedupe_key text not null unique,
  scheduled_for timestamptz not null default timezone('utc', now()),
  next_attempt_at timestamptz not null default timezone('utc', now()),
  attempt_count integer not null default 0,
  status text not null default 'pending',
  failure_reason text,
  last_error text,
  last_attempt_at timestamptz,
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.scan_logs (
  id uuid primary key default gen_random_uuid(),
  scan_job_id uuid references public.scan_job_queue (id) on delete set null,
  website_id uuid references public.websites (id) on delete cascade,
  user_id uuid references public.users (id) on delete set null,
  status text not null,
  failure_reason text,
  error_message text,
  started_at timestamptz not null default timezone('utc', now()),
  finished_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.ssl_checks (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references public.websites (id) on delete cascade,
  is_valid boolean not null default false,
  expiry_date timestamptz,
  days_until_expiry integer,
  issuer text,
  grade text not null default 'critical',
  checked_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.security_headers (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references public.websites (id) on delete cascade,
  hsts boolean not null default false,
  hsts_value text,
  csp boolean not null default false,
  csp_value text,
  x_frame_options boolean not null default false,
  x_frame_options_value text,
  x_content_type boolean not null default false,
  x_content_type_value text,
  referrer_policy boolean not null default false,
  referrer_policy_value text,
  permissions_policy boolean not null default false,
  permissions_policy_value text,
  grade text not null default 'F',
  checked_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.seo_audit (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references public.websites (id) on delete cascade,
  scan_id uuid not null references public.scan_results (id) on delete cascade,
  title_tag jsonb not null default '{}'::jsonb,
  meta_description jsonb not null default '{}'::jsonb,
  headings jsonb not null default '{}'::jsonb,
  images_missing_alt integer not null default 0,
  images_missing_alt_urls jsonb not null default '[]'::jsonb,
  og_tags jsonb not null default '{}'::jsonb,
  twitter_tags jsonb not null default '{}'::jsonb,
  canonical jsonb not null default '{}'::jsonb,
  schema_present boolean not null default false,
  schema_types jsonb not null default '[]'::jsonb,
  fix_suggestions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.crux_data (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references public.websites (id) on delete cascade,
  lcp_good_pct numeric(5,2) not null default 0,
  lcp_needs_pct numeric(5,2) not null default 0,
  lcp_poor_pct numeric(5,2) not null default 0,
  cls_good_pct numeric(5,2) not null default 0,
  cls_needs_pct numeric(5,2) not null default 0,
  cls_poor_pct numeric(5,2) not null default 0,
  inp_good_pct numeric(5,2) not null default 0,
  inp_needs_pct numeric(5,2) not null default 0,
  inp_poor_pct numeric(5,2) not null default 0,
  fcp_good_pct numeric(5,2) not null default 0,
  fcp_needs_pct numeric(5,2) not null default 0,
  fcp_poor_pct numeric(5,2) not null default 0,
  ttfb_good_pct numeric(5,2) not null default 0,
  ttfb_needs_pct numeric(5,2) not null default 0,
  ttfb_poor_pct numeric(5,2) not null default 0,
  raw_payload jsonb not null default '{}'::jsonb,
  fetched_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.broken_links (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references public.websites (id) on delete cascade,
  scan_id uuid references public.scan_results (id) on delete set null,
  total_links integer not null default 0,
  working_links integer not null default 0,
  broken_links integer not null default 0,
  redirect_chains integer not null default 0,
  broken_urls jsonb not null default '[]'::jsonb,
  redirect_urls jsonb not null default '[]'::jsonb,
  scanned_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.uptime_checks (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references public.websites (id) on delete cascade,
  checked_at timestamptz not null default timezone('utc', now()),
  status public.uptime_status not null,
  response_time_ms integer,
  source public.uptime_source not null default 'vercel',
  incident_reason text,
  raw_payload jsonb not null default '{}'::jsonb
);

create table if not exists public.competitor_scans (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references public.websites (id) on delete cascade,
  competitor_url text not null,
  performance integer not null default 0 check (performance >= 0 and performance <= 100),
  seo integer not null default 0 check (seo >= 0 and seo <= 100),
  accessibility integer not null default 0 check (accessibility >= 0 and accessibility <= 100),
  best_practices integer not null default 0 check (best_practices >= 0 and best_practices <= 100),
  scan_status public.scan_status not null default 'success',
  error_message text,
  scanned_at timestamptz not null default timezone('utc', now())
);

alter table public.users add column if not exists uptimerobot_api_key text;
alter table public.users add column if not exists timezone text not null default 'UTC';
alter table public.users add column if not exists paddle_customer_id text;
alter table public.users add column if not exists paddle_subscription_id text;
alter table public.users add column if not exists billing_cycle public.billing_cycle;
alter table public.users add column if not exists subscription_price integer;
alter table public.users add column if not exists subscription_status public.subscription_status;
alter table public.users add column if not exists next_billing_date timestamptz;
alter table public.users add column if not exists last_payment_date timestamptz;
alter table public.users add column if not exists trial_end_date timestamptz;
alter table public.users add column if not exists trial_ends_at timestamptz;
alter table public.users add column if not exists is_trial boolean not null default false;
alter table public.users add column if not exists ip_address text;
alter table public.users add column if not exists country text;
alter table public.users add column if not exists city text;
alter table public.users add column if not exists region text;
alter table public.users add column if not exists located_at timestamptz;
alter table public.websites add column if not exists competitor_urls jsonb not null default '[]'::jsonb;
alter table public.websites add column if not exists email_report_frequency public.scan_frequency not null default 'weekly';
alter table public.websites add column if not exists report_frequency text;
alter table public.websites add column if not exists extra_recipients text[];
alter table public.websites add column if not exists auto_email_reports boolean;
alter table public.websites add column if not exists email_notifications boolean;
alter table public.websites add column if not exists client_dashboard_enabled boolean not null default false;
alter table public.websites add column if not exists client_dashboard_use_branding_logo boolean not null default true;
alter table public.websites add column if not exists magic_token text;
alter table public.websites add column if not exists gsc_access_token text;
alter table public.websites add column if not exists gsc_refresh_token text;
alter table public.websites add column if not exists gsc_property text;
alter table public.websites add column if not exists gsc_connected_at timestamptz;
alter table public.websites add column if not exists ga_access_token text;
alter table public.websites add column if not exists ga_refresh_token text;
alter table public.websites add column if not exists ga_property_id text;
alter table public.websites add column if not exists ga_connected_at timestamptz;

update public.websites
set report_frequency = coalesce(report_frequency, email_report_frequency::text, 'weekly')
where report_frequency is null;

update public.websites
set extra_recipients = coalesce(extra_recipients, report_recipients, '{}'::text[])
where extra_recipients is null;

update public.websites
set auto_email_reports = coalesce(auto_email_reports, email_reports_enabled, true)
where auto_email_reports is null;

update public.websites
set email_notifications = coalesce(email_notifications, true)
where email_notifications is null;

alter table public.websites alter column report_frequency set default 'weekly';
alter table public.websites alter column report_frequency set not null;
alter table public.websites alter column extra_recipients set default '{}'::text[];
alter table public.websites alter column extra_recipients set not null;
alter table public.websites alter column auto_email_reports set default true;
alter table public.websites alter column auto_email_reports set not null;
alter table public.websites alter column email_notifications set default true;
alter table public.websites alter column email_notifications set not null;
alter table public.websites alter column client_dashboard_enabled set default false;
alter table public.websites alter column client_dashboard_enabled set not null;
alter table public.websites alter column client_dashboard_use_branding_logo set default true;
alter table public.websites alter column client_dashboard_use_branding_logo set not null;
alter table public.agency_branding add column if not exists reply_to_email text;
alter table public.agency_branding add column if not exists agency_website_url text;
alter table public.agency_branding add column if not exists report_footer_text text;
alter table public.contact_messages add column if not exists name text;
alter table public.contact_messages add column if not exists email text;
alter table public.contact_messages add column if not exists subject text;
alter table public.contact_messages add column if not exists message text;
alter table public.contact_messages add column if not exists status text;
alter table public.contact_messages add column if not exists admin_reply text;
alter table public.contact_messages add column if not exists replied_at timestamptz;
alter table public.contact_messages add column if not exists created_at timestamptz;
alter table public.contact_messages add column if not exists user_id uuid references auth.users (id) on delete set null;
alter table public.contact_messages alter column created_at set default timezone('utc', now());
alter table public.contact_messages alter column status set default 'unread';
create index if not exists contact_messages_email_created_at_idx
  on public.contact_messages (email, created_at desc);
create index if not exists contact_messages_status_created_at_idx
  on public.contact_messages (status, created_at desc);
alter table public.users alter column subscription_status set default 'inactive';
alter table public.users drop column if exists stripe_customer_id;
alter table public.users drop column if exists stripe_subscription_id;
alter table public.users drop column if exists paypal_subscription_id;
alter table public.users drop column if exists paypal_plan_id;
alter table public.users drop column if exists paypal_payer_id;

alter table public.websites
  drop constraint if exists websites_competitor_urls_is_array;
alter table public.websites
  add constraint websites_competitor_urls_is_array
  check (
    jsonb_typeof(competitor_urls) = 'array'
    and jsonb_array_length(competitor_urls) <= 3
  );

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  website_id uuid references public.websites (id) on delete cascade,
  type public.notification_type not null,
  title text not null,
  body text not null,
  severity public.severity_level not null default 'medium',
  is_read boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_websites_user_id on public.websites (user_id);
create index if not exists idx_subscriptions_user_id on public.subscriptions (user_id);
create index if not exists idx_subscriptions_status on public.subscriptions (status, updated_at desc);
create index if not exists idx_subscriptions_email on public.subscriptions (lower(email));
create index if not exists idx_billing_plan_prices_lookup
  on public.billing_plan_prices (plan_key, billing_cycle);
create index if not exists idx_users_timezone on public.users (timezone);
create unique index if not exists idx_websites_magic_token
  on public.websites (magic_token)
  where magic_token is not null;
create index if not exists idx_scan_results_website_id on public.scan_results (website_id);
create index if not exists idx_scan_results_scanned_at on public.scan_results (scanned_at desc);
create index if not exists idx_reports_website_id on public.reports (website_id);
create index if not exists idx_reports_scan_id on public.reports (scan_id);
create index if not exists idx_report_ai_cache_owner_expires on public.report_ai_cache (owner_user_id, expires_at desc);
create index if not exists idx_report_ai_cache_scan_id on public.report_ai_cache (scan_id);
create index if not exists idx_preview_scan_sessions_url_expires on public.preview_scan_sessions (normalized_url, expires_at desc);
create index if not exists idx_preview_scan_sessions_claimed_by on public.preview_scan_sessions (claimed_by_user_id);
create index if not exists idx_notifications_user_id_created_at on public.notifications (user_id, created_at desc);
create index if not exists idx_team_members_owner on public.team_members (owner_user_id);
create index if not exists idx_team_members_owner_joined on public.team_members (owner_user_id, joined_at desc);
create index if not exists idx_team_invites_owner_status on public.team_invites (workspace_owner_id, status, created_at desc);
create index if not exists idx_team_invites_email_status on public.team_invites (invited_email, status);
create index if not exists idx_ssl_checks_website_checked_at on public.ssl_checks (website_id, checked_at desc);
create index if not exists idx_security_headers_website_checked_at on public.security_headers (website_id, checked_at desc);
create index if not exists idx_seo_audit_website_created_at on public.seo_audit (website_id, created_at desc);
create index if not exists idx_seo_audit_scan_id on public.seo_audit (scan_id);
create index if not exists idx_crux_data_website_fetched_at on public.crux_data (website_id, fetched_at desc);
create index if not exists idx_broken_links_website_scanned_at on public.broken_links (website_id, scanned_at desc);
create index if not exists idx_uptime_checks_website_checked_at on public.uptime_checks (website_id, checked_at desc);
create index if not exists idx_competitor_scans_website_scanned_at on public.competitor_scans (website_id, scanned_at desc);
create index if not exists idx_payment_logs_timestamp on public.payment_logs (timestamp desc);
create index if not exists idx_payment_logs_email on public.payment_logs (lower(user_email), timestamp desc);
create index if not exists idx_payment_logs_subscription on public.payment_logs (paddle_subscription_id, timestamp desc);
create index if not exists idx_manual_revenue_entries_user_id
  on public.manual_revenue_entries (user_id);
create index if not exists idx_manual_revenue_entries_created_at
  on public.manual_revenue_entries (created_at desc);
create index if not exists idx_paddle_webhook_events_status_retry
  on public.paddle_webhook_events (status, next_retry_at asc, created_at asc);
create index if not exists idx_report_email_queue_status_scheduled
  on public.report_email_queue (status, next_attempt_at asc);
create index if not exists idx_job_queue_status_created_at
  on public.job_queue (status, created_at asc);
create index if not exists idx_report_generation_queue_status_scheduled
  on public.report_generation_queue (status, next_attempt_at asc);
create index if not exists idx_report_generation_queue_user_period
  on public.report_generation_queue (user_id, website_id, period_key);
create index if not exists idx_report_generation_queue_completed_at
  on public.report_generation_queue (completed_at desc);
create index if not exists idx_report_email_queue_user_period
  on public.report_email_queue (user_id, website_id, period_key);
create index if not exists idx_report_email_queue_sent_at
  on public.report_email_queue (sent_at desc);
create index if not exists idx_sent_lifecycle_emails_user_id
  on public.sent_lifecycle_emails (user_id);
create index if not exists idx_sent_lifecycle_emails_email_type_sent_at
  on public.sent_lifecycle_emails (email_type, sent_at desc);
create index if not exists idx_scan_job_queue_status_scheduled
  on public.scan_job_queue (status, next_attempt_at asc);
create index if not exists idx_scan_job_queue_user_period
  on public.scan_job_queue (user_id, website_id, period_key);
create index if not exists idx_scan_job_queue_completed_at
  on public.scan_job_queue (completed_at desc);
create index if not exists idx_scan_logs_website_started_at
  on public.scan_logs (website_id, started_at desc);
create index if not exists idx_scan_logs_user_started_at
  on public.scan_logs (user_id, started_at desc);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (
    id,
    email,
    full_name,
    plan,
    billing_cycle,
    subscription_price,
    subscription_status,
    trial_end_date,
    trial_ends_at,
    is_trial
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    'starter',
    'monthly',
    49,
    'trialing',
    timezone('utc', now()) + interval '14 day',
    timezone('utc', now()) + interval '14 day',
    true
  )
  on conflict (id) do update
  set email = excluded.email;

  insert into public.agency_branding (user_id, agency_name, email_from_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'agency_name',
      new.raw_user_meta_data ->> 'full_name',
      split_part(new.email, '@', 1)
    ),
    coalesce(
      new.raw_user_meta_data ->> 'agency_name',
      split_part(new.email, '@', 1)
    )
  )
  on conflict (user_id) do nothing;

  update public.team_members
  set member_user_id = new.id,
      status = 'active'
  where lower(member_email) = lower(new.email)
    and member_user_id is null;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

drop trigger if exists users_updated_at on public.users;
create trigger users_updated_at
  before update on public.users
  for each row execute procedure public.handle_updated_at();

drop trigger if exists agency_branding_updated_at on public.agency_branding;
create trigger agency_branding_updated_at
  before update on public.agency_branding
  for each row execute procedure public.handle_updated_at();

drop trigger if exists websites_updated_at on public.websites;
create trigger websites_updated_at
  before update on public.websites
  for each row execute procedure public.handle_updated_at();

drop trigger if exists report_ai_cache_updated_at on public.report_ai_cache;
create trigger report_ai_cache_updated_at
  before update on public.report_ai_cache
  for each row execute procedure public.handle_updated_at();

drop trigger if exists subscriptions_updated_at on public.subscriptions;
create trigger subscriptions_updated_at
  before update on public.subscriptions
  for each row execute procedure public.handle_updated_at();

drop trigger if exists billing_plan_prices_updated_at on public.billing_plan_prices;
create trigger billing_plan_prices_updated_at
  before update on public.billing_plan_prices
  for each row execute procedure public.handle_updated_at();

drop trigger if exists paddle_webhook_events_updated_at on public.paddle_webhook_events;
create trigger paddle_webhook_events_updated_at
  before update on public.paddle_webhook_events
  for each row execute procedure public.handle_updated_at();

create or replace function public.user_can_access_owner(target_owner uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() = target_owner
    or exists (
      select 1
      from public.team_members tm
      where tm.owner_user_id = target_owner
        and tm.member_user_id = auth.uid()
        and tm.status = 'active'
    );
$$;

create or replace function public.website_owner(site_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select w.user_id
  from public.websites w
  where w.id = site_id;
$$;

create or replace function public.next_scan_date(frequency public.scan_frequency, anchor timestamptz)
returns timestamptz
language sql
immutable
as $$
  select case
    when frequency = 'daily' then anchor + interval '1 day'
    when frequency = 'weekly' then anchor + interval '7 day'
    else anchor + interval '1 month'
  end;
$$;

create or replace function public.purge_old_scan_results()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.scan_results sr
  using public.websites w
  join public.users u on u.id = w.user_id
  where sr.website_id = w.id
    and sr.scanned_at < case
      when u.plan = 'free' then timezone('utc', now()) - interval '30 day'
      when u.plan = 'starter' then timezone('utc', now()) - interval '90 day'
      else timezone('utc', now()) - interval '365 day'
    end;
end;
$$;

alter table public.users enable row level security;
alter table public.sent_lifecycle_emails enable row level security;
alter table public.subscriptions enable row level security;
alter table public.billing_plan_prices enable row level security;
alter table public.payment_logs enable row level security;
alter table public.manual_revenue_entries enable row level security;
alter table public.paddle_webhook_events enable row level security;
alter table public.agency_branding enable row level security;
alter table public.contact_messages enable row level security;
alter table public.team_members enable row level security;
alter table public.team_invites enable row level security;
alter table public.websites enable row level security;
alter table public.scan_results enable row level security;
alter table public.reports enable row level security;
alter table public.report_ai_cache enable row level security;
alter table public.preview_scan_sessions enable row level security;
alter table public.scan_schedules enable row level security;
alter table public.notifications enable row level security;
alter table public.ssl_checks enable row level security;
alter table public.security_headers enable row level security;
alter table public.seo_audit enable row level security;
alter table public.crux_data enable row level security;
alter table public.broken_links enable row level security;
alter table public.uptime_checks enable row level security;
alter table public.competitor_scans enable row level security;

drop policy if exists "Users can view own profile" on public.users;
create policy "Users can view own profile"
  on public.users for select
  using (auth.uid() = id);

drop policy if exists "Users can view own subscriptions" on public.subscriptions;
create policy "Users can view own subscriptions"
  on public.subscriptions for select
  using (auth.uid() = user_id);

drop policy if exists "Users can view own payment logs" on public.payment_logs;
create policy "Users can view own payment logs"
  on public.payment_logs for select
  using (auth.uid() = user_id);

drop policy if exists "Users can update own profile" on public.users;
create policy "Users can update own profile"
  on public.users for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Users can view own branding" on public.agency_branding;
create policy "Users can view own branding"
  on public.agency_branding for select
  using (public.user_can_access_owner(user_id));

drop policy if exists "Users can manage own branding" on public.agency_branding;
create policy "Users can manage own branding"
  on public.agency_branding for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Owners can view team members" on public.team_members;
create policy "Owners can view team members"
  on public.team_members for select
  using (auth.uid() = owner_user_id or auth.uid() = member_user_id);

drop policy if exists "Owners can manage team members" on public.team_members;
create policy "Owners can manage team members"
  on public.team_members for all
  using (auth.uid() = owner_user_id)
  with check (auth.uid() = owner_user_id);

drop policy if exists "Owners can view team invites" on public.team_invites;
create policy "Owners can view team invites"
  on public.team_invites for select
  using (auth.uid() = workspace_owner_id);

drop policy if exists "Owners can manage team invites" on public.team_invites;
create policy "Owners can manage team invites"
  on public.team_invites for all
  using (auth.uid() = workspace_owner_id)
  with check (auth.uid() = workspace_owner_id);

drop policy if exists "Users can view accessible websites" on public.websites;
create policy "Users can view accessible websites"
  on public.websites for select
  using (public.user_can_access_owner(user_id));

drop policy if exists "Users can create own websites" on public.websites;
create policy "Users can create own websites"
  on public.websites for insert
  with check (auth.uid() = user_id);

drop policy if exists "Owners can update accessible websites" on public.websites;
create policy "Owners can update accessible websites"
  on public.websites for update
  using (public.user_can_access_owner(user_id))
  with check (public.user_can_access_owner(user_id));

drop policy if exists "Owners can delete own websites" on public.websites;
create policy "Owners can delete own websites"
  on public.websites for delete
  using (auth.uid() = user_id);

drop policy if exists "Users can view accessible scan results" on public.scan_results;
create policy "Users can view accessible scan results"
  on public.scan_results for select
  using (public.user_can_access_owner(public.website_owner(website_id)));

drop policy if exists "Owners can insert scan results" on public.scan_results;
create policy "Owners can insert scan results"
  on public.scan_results for insert
  with check (public.user_can_access_owner(public.website_owner(website_id)));

drop policy if exists "Owners can update scan results" on public.scan_results;
create policy "Owners can update scan results"
  on public.scan_results for update
  using (public.user_can_access_owner(public.website_owner(website_id)))
  with check (public.user_can_access_owner(public.website_owner(website_id)));

drop policy if exists "Users can view accessible reports" on public.reports;
create policy "Users can view accessible reports"
  on public.reports for select
  using (public.user_can_access_owner(public.website_owner(website_id)));

drop policy if exists "Owners can insert reports" on public.reports;
create policy "Owners can insert reports"
  on public.reports for insert
  with check (public.user_can_access_owner(public.website_owner(website_id)));

drop policy if exists "Owners can update reports" on public.reports;
create policy "Owners can update reports"
  on public.reports for update
  using (public.user_can_access_owner(public.website_owner(website_id)))
  with check (public.user_can_access_owner(public.website_owner(website_id)));

drop policy if exists "Users can view accessible report ai cache" on public.report_ai_cache;
create policy "Users can view accessible report ai cache"
  on public.report_ai_cache for select
  using (public.user_can_access_owner(owner_user_id));

drop policy if exists "Owners can manage report ai cache" on public.report_ai_cache;
create policy "Owners can manage report ai cache"
  on public.report_ai_cache for all
  using (auth.uid() = owner_user_id)
  with check (auth.uid() = owner_user_id);

drop policy if exists "Users can view accessible schedules" on public.scan_schedules;
create policy "Users can view accessible schedules"
  on public.scan_schedules for select
  using (
    public.user_can_access_owner(
      public.website_owner(website_id)
    )
  );

drop policy if exists "Owners can manage schedules" on public.scan_schedules;
create policy "Owners can manage schedules"
  on public.scan_schedules for all
  using (public.user_can_access_owner(public.website_owner(website_id)))
  with check (public.user_can_access_owner(public.website_owner(website_id)));

drop policy if exists "Users can view own notifications" on public.notifications;
create policy "Users can view own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

drop policy if exists "Users can manage own notifications" on public.notifications;
create policy "Users can manage own notifications"
  on public.notifications for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can view accessible ssl checks" on public.ssl_checks;
create policy "Users can view accessible ssl checks"
  on public.ssl_checks for select
  using (public.user_can_access_owner(public.website_owner(website_id)));

drop policy if exists "Owners can manage ssl checks" on public.ssl_checks;
create policy "Owners can manage ssl checks"
  on public.ssl_checks for all
  using (public.user_can_access_owner(public.website_owner(website_id)))
  with check (public.user_can_access_owner(public.website_owner(website_id)));

drop policy if exists "Users can view accessible security headers" on public.security_headers;
create policy "Users can view accessible security headers"
  on public.security_headers for select
  using (public.user_can_access_owner(public.website_owner(website_id)));

drop policy if exists "Owners can manage security headers" on public.security_headers;
create policy "Owners can manage security headers"
  on public.security_headers for all
  using (public.user_can_access_owner(public.website_owner(website_id)))
  with check (public.user_can_access_owner(public.website_owner(website_id)));

drop policy if exists "Users can view accessible seo audit" on public.seo_audit;
create policy "Users can view accessible seo audit"
  on public.seo_audit for select
  using (public.user_can_access_owner(public.website_owner(website_id)));

drop policy if exists "Owners can manage seo audit" on public.seo_audit;
create policy "Owners can manage seo audit"
  on public.seo_audit for all
  using (public.user_can_access_owner(public.website_owner(website_id)))
  with check (public.user_can_access_owner(public.website_owner(website_id)));

drop policy if exists "Users can view accessible crux data" on public.crux_data;
create policy "Users can view accessible crux data"
  on public.crux_data for select
  using (public.user_can_access_owner(public.website_owner(website_id)));

drop policy if exists "Owners can manage crux data" on public.crux_data;
create policy "Owners can manage crux data"
  on public.crux_data for all
  using (public.user_can_access_owner(public.website_owner(website_id)))
  with check (public.user_can_access_owner(public.website_owner(website_id)));

drop policy if exists "Users can view accessible broken links" on public.broken_links;
create policy "Users can view accessible broken links"
  on public.broken_links for select
  using (public.user_can_access_owner(public.website_owner(website_id)));

drop policy if exists "Owners can manage broken links" on public.broken_links;
create policy "Owners can manage broken links"
  on public.broken_links for all
  using (public.user_can_access_owner(public.website_owner(website_id)))
  with check (public.user_can_access_owner(public.website_owner(website_id)));

drop policy if exists "Users can view accessible uptime checks" on public.uptime_checks;
create policy "Users can view accessible uptime checks"
  on public.uptime_checks for select
  using (public.user_can_access_owner(public.website_owner(website_id)));

drop policy if exists "Owners can manage uptime checks" on public.uptime_checks;
create policy "Owners can manage uptime checks"
  on public.uptime_checks for all
  using (public.user_can_access_owner(public.website_owner(website_id)))
  with check (public.user_can_access_owner(public.website_owner(website_id)));

drop policy if exists "Users can view accessible competitor scans" on public.competitor_scans;
create policy "Users can view accessible competitor scans"
  on public.competitor_scans for select
  using (public.user_can_access_owner(public.website_owner(website_id)));

drop policy if exists "Owners can manage competitor scans" on public.competitor_scans;
create policy "Owners can manage competitor scans"
  on public.competitor_scans for all
  using (public.user_can_access_owner(public.website_owner(website_id)))
  with check (public.user_can_access_owner(public.website_owner(website_id)));

insert into storage.buckets (id, name, public)
values
  ('reports', 'reports', false),
  ('profile-assets', 'profile-assets', true),
  ('branding-assets', 'branding-assets', true)
on conflict (id) do nothing;

drop policy if exists "Users can read private report assets" on storage.objects;
create policy "Users can read private report assets"
  on storage.objects for select
  using (
    bucket_id in ('reports', 'profile-assets', 'branding-assets')
    and public.user_can_access_owner(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "Users can write private assets" on storage.objects;
create policy "Users can write private assets"
  on storage.objects for insert
  with check (
    bucket_id in ('reports', 'profile-assets', 'branding-assets')
    and public.user_can_access_owner(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "Users can update private assets" on storage.objects;
create policy "Users can update private assets"
  on storage.objects for update
  using (
    bucket_id in ('reports', 'profile-assets', 'branding-assets')
    and public.user_can_access_owner(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id in ('reports', 'profile-assets', 'branding-assets')
    and public.user_can_access_owner(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "Users can delete private assets" on storage.objects;
create policy "Users can delete private assets"
  on storage.objects for delete
  using (
    bucket_id in ('reports', 'profile-assets', 'branding-assets')
    and public.user_can_access_owner(((storage.foldername(name))[1])::uuid)
  );
