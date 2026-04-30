create table if not exists public.cron_logs (
  id uuid primary key default gen_random_uuid(),
  cron_name text not null,
  started_at timestamptz not null default timezone('utc', now()),
  finished_at timestamptz,
  status text not null default 'running',
  items_processed integer not null default 0,
  error_message text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.admin_error_logs (
  id uuid primary key default gen_random_uuid(),
  error_type text not null,
  error_message text not null,
  website_id uuid references public.websites (id) on delete set null,
  user_id uuid references public.users (id) on delete set null,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.email_logs (
  id uuid primary key default gen_random_uuid(),
  to_email text not null,
  subject text not null,
  email_type text not null,
  template_id text,
  dedupe_key text,
  campaign text,
  status text not null,
  website_id uuid references public.websites (id) on delete set null,
  user_id uuid references public.users (id) on delete set null,
  provider text,
  provider_message_id text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  triggered_at timestamptz not null default timezone('utc', now()),
  sent_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.email_logs add column if not exists template_id text;
alter table public.email_logs add column if not exists dedupe_key text;
alter table public.email_logs add column if not exists campaign text;
alter table public.email_logs add column if not exists triggered_at timestamptz not null default timezone('utc', now());

create index if not exists idx_cron_logs_name_started_at on public.cron_logs (cron_name, started_at desc);
create index if not exists idx_admin_error_logs_created_at on public.admin_error_logs (created_at desc);
create index if not exists idx_admin_error_logs_type_created_at on public.admin_error_logs (error_type, created_at desc);
create index if not exists idx_email_logs_sent_at on public.email_logs (sent_at desc);
create index if not exists idx_email_logs_to_sent_at on public.email_logs (to_email, sent_at desc);
create index if not exists idx_email_logs_dedupe_status on public.email_logs (dedupe_key, status);
create index if not exists idx_email_logs_template_id on public.email_logs (template_id, sent_at desc);

alter table public.users add column if not exists timezone text not null default 'UTC';

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

create index if not exists idx_report_generation_queue_status_scheduled on public.report_generation_queue (status, next_attempt_at asc);
create index if not exists idx_report_generation_queue_user_period on public.report_generation_queue (user_id, website_id, period_key);
create index if not exists idx_report_generation_queue_completed_at on public.report_generation_queue (completed_at desc);
create index if not exists idx_report_email_queue_status_scheduled on public.report_email_queue (status, next_attempt_at asc);
create index if not exists idx_report_email_queue_user_period on public.report_email_queue (user_id, website_id, period_key);
create index if not exists idx_report_email_queue_sent_at on public.report_email_queue (sent_at desc);
create index if not exists idx_scan_job_queue_status_scheduled on public.scan_job_queue (status, next_attempt_at asc);
create index if not exists idx_scan_job_queue_user_period on public.scan_job_queue (user_id, website_id, period_key);
create index if not exists idx_scan_job_queue_completed_at on public.scan_job_queue (completed_at desc);
create index if not exists idx_scan_logs_website_started_at on public.scan_logs (website_id, started_at desc);
create index if not exists idx_scan_logs_user_started_at on public.scan_logs (user_id, started_at desc);
