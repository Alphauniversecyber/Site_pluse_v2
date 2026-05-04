alter table public.websites
  add column if not exists package text,
  add column if not exists branding_logo text,
  add column if not exists branding_name text,
  add column if not exists branding_color text,
  add column if not exists client_dashboard_enabled boolean not null default false,
  add column if not exists client_dashboard_use_branding_logo boolean not null default true;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'websites_package_check'
      and conrelid = 'public.websites'::regclass
  ) then
    alter table public.websites
      add constraint websites_package_check
      check (package is null or package in ('growth', 'pro', 'enterprise'));
  end if;
end $$;

update public.websites w
set
  package = case
    when u.plan = 'agency' then 'pro'
    else 'growth'
  end,
  branding_name = coalesce(w.branding_name, w.label),
  branding_color = coalesce(w.branding_color, '#3b82f6')
from public.users u
where u.id = w.user_id
  and (
    w.package is null
    or btrim(w.package) = ''
    or w.branding_name is null
    or w.branding_color is null
  );
