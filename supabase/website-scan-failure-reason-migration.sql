alter table public.websites
  add column if not exists failure_reason text;
