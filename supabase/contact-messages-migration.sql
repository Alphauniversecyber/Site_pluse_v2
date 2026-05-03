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

alter table public.contact_messages enable row level security;
