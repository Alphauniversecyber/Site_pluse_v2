alter table public.websites add column if not exists report_frequency text;
alter table public.websites add column if not exists extra_recipients text[];
alter table public.websites add column if not exists auto_email_reports boolean;
alter table public.websites add column if not exists email_notifications boolean;

update public.websites
set report_frequency = coalesce(report_frequency, email_report_frequency::text, 'weekly')
where report_frequency is null;

update public.websites
set extra_recipients = coalesce(extra_recipients, report_recipients, '{}'::text[])
where extra_recipients is null;

update public.websites
set auto_email_reports = coalesce(auto_email_reports, email_reports_enabled, true)
where auto_email_reports is null;

update public.websites
set email_notifications = coalesce(email_notifications, true)
where email_notifications is null;

alter table public.websites
  drop constraint if exists websites_report_frequency_check;

alter table public.websites
  add constraint websites_report_frequency_check
  check (report_frequency in ('daily', 'weekly', 'monthly', 'never'));

alter table public.websites alter column report_frequency set default 'weekly';
alter table public.websites alter column report_frequency set not null;
alter table public.websites alter column extra_recipients set default '{}'::text[];
alter table public.websites alter column extra_recipients set not null;
alter table public.websites alter column auto_email_reports set default true;
alter table public.websites alter column auto_email_reports set not null;
alter table public.websites alter column email_notifications set default true;
alter table public.websites alter column email_notifications set not null;
