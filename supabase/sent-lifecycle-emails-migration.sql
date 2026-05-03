create table if not exists public.sent_lifecycle_emails (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  email_type text not null,
  sent_at timestamptz not null default timezone('utc', now()),
  unique (user_id, email_type)
);

create index if not exists idx_sent_lifecycle_emails_user_id
  on public.sent_lifecycle_emails (user_id);

create index if not exists idx_sent_lifecycle_emails_email_type_sent_at
  on public.sent_lifecycle_emails (email_type, sent_at desc);

alter table public.sent_lifecycle_emails enable row level security;
