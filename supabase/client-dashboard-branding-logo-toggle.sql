alter table public.websites
  add column if not exists client_dashboard_use_branding_logo boolean not null default true;
