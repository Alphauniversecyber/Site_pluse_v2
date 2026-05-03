alter table public.agency_branding
  add column if not exists reply_to_email text,
  add column if not exists agency_website_url text,
  add column if not exists report_footer_text text;

alter table public.websites
  add column if not exists client_dashboard_enabled boolean not null default false;
