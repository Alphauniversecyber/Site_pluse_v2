alter table public.users add column if not exists ip_address text;
alter table public.users add column if not exists country text;
alter table public.users add column if not exists city text;
alter table public.users add column if not exists region text;
alter table public.users add column if not exists located_at timestamptz;
