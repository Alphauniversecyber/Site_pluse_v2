create table if not exists public.team_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_owner_id uuid not null references public.users (id) on delete cascade,
  invited_email text not null,
  role text not null check (role in ('viewer', 'admin')),
  token uuid not null unique,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default timezone('utc', now()),
  accepted_at timestamptz
);

create index if not exists idx_team_invites_owner_status
  on public.team_invites (workspace_owner_id, status, created_at desc);

create index if not exists idx_team_invites_email_status
  on public.team_invites (invited_email, status);

alter table public.team_members
  add column if not exists joined_at timestamptz;

update public.team_members
set joined_at = coalesce(joined_at, invited_at, timezone('utc', now()))
where status = 'active'
  and joined_at is null;

create index if not exists idx_team_members_owner_joined
  on public.team_members (owner_user_id, joined_at desc);

alter table public.team_invites enable row level security;

drop policy if exists "Owners can view team invites" on public.team_invites;
create policy "Owners can view team invites"
  on public.team_invites for select
  using (auth.uid() = workspace_owner_id);

drop policy if exists "Owners can manage team invites" on public.team_invites;
create policy "Owners can manage team invites"
  on public.team_invites for all
  using (auth.uid() = workspace_owner_id)
  with check (auth.uid() = workspace_owner_id);
