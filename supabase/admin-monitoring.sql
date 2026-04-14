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
  status text not null,
  website_id uuid references public.websites (id) on delete set null,
  user_id uuid references public.users (id) on delete set null,
  provider text,
  provider_message_id text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  sent_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_cron_logs_name_started_at on public.cron_logs (cron_name, started_at desc);
create index if not exists idx_admin_error_logs_created_at on public.admin_error_logs (created_at desc);
create index if not exists idx_admin_error_logs_type_created_at on public.admin_error_logs (error_type, created_at desc);
create index if not exists idx_email_logs_sent_at on public.email_logs (sent_at desc);
create index if not exists idx_email_logs_to_sent_at on public.email_logs (to_email, sent_at desc);
