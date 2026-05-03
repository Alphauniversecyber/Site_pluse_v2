create table if not exists public.failed_tasks (
  id uuid primary key default gen_random_uuid(),
  cron_name text not null,
  task_type text not null,
  user_id uuid references auth.users (id) on delete set null,
  site_id uuid references public.websites (id) on delete set null,
  error_message text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'failed' check (status in ('failed', 'retried', 'resolved')),
  created_at timestamptz not null default timezone('utc', now()),
  retried_at timestamptz
);

create index if not exists idx_failed_tasks_status_created_at
  on public.failed_tasks (status, created_at desc);

create index if not exists idx_failed_tasks_cron_created_at
  on public.failed_tasks (cron_name, created_at desc);

create index if not exists idx_failed_tasks_user_created_at
  on public.failed_tasks (user_id, created_at desc);

create index if not exists idx_failed_tasks_site_created_at
  on public.failed_tasks (site_id, created_at desc);
