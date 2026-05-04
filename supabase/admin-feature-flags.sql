create table if not exists public.admin_feature_flags (
  key text primary key,
  enabled boolean not null default true,
  allowed_packages jsonb not null default '["trial","free","growth","pro"]'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.touch_admin_feature_flags_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists touch_admin_feature_flags_updated_at on public.admin_feature_flags;
create trigger touch_admin_feature_flags_updated_at
before update on public.admin_feature_flags
for each row
execute function public.touch_admin_feature_flags_updated_at();

insert into public.admin_feature_flags (key, enabled, allowed_packages)
values ('client_dashboard', true, '["trial","free","growth","pro"]'::jsonb)
on conflict (key) do nothing;
