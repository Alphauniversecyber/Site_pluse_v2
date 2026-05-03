alter table public.users
  add column if not exists plan_override boolean not null default false,
  add column if not exists plan_override_counts_as_revenue boolean not null default false;

create table if not exists public.manual_revenue_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  plan text not null,
  amount numeric(10,2) not null check (amount >= 0),
  note text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_manual_revenue_entries_user_id
  on public.manual_revenue_entries (user_id);

create index if not exists idx_manual_revenue_entries_created_at
  on public.manual_revenue_entries (created_at desc);

alter table public.manual_revenue_entries enable row level security;
