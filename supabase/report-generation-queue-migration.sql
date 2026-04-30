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

create index if not exists idx_report_generation_queue_status_scheduled
  on public.report_generation_queue (status, next_attempt_at asc);
create index if not exists idx_report_generation_queue_user_period
  on public.report_generation_queue (user_id, website_id, period_key);
create index if not exists idx_report_generation_queue_completed_at
  on public.report_generation_queue (completed_at desc);
