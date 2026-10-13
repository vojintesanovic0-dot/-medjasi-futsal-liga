-- Međasi Futsal Liga: push notification preference for favorite teams
create table if not exists public.push_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  followed_only boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.push_prefs enable row level security;

drop policy if exists push_prefs_own on public.push_prefs;
create policy push_prefs_own on public.push_prefs
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
