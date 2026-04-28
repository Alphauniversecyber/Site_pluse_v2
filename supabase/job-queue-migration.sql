create table if not exists public.job_queue (
  id uuid primary key default gen_random_uuid(),
  job_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'processing', 'done', 'failed')),
  created_at timestamptz not null default timezone('utc', now()),
  processed_at timestamptz
);

create index if not exists idx_job_queue_status_created_at
  on public.job_queue (status, created_at asc);
