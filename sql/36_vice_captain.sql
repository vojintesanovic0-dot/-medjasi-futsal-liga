-- Add a persistent vice-captain role while preserving existing captain records.
alter table public.players
  add column if not exists is_vice_captain boolean not null default false;

-- Enforce at most one vice-captain per team, including concurrent admin writes.
create unique index if not exists players_one_vice_captain_per_team_idx
  on public.players (team_id)
  where is_vice_captain is true and team_id is not null;

-- One player cannot hold both captain roles.
alter table public.players
  drop constraint if exists players_captain_roles_distinct_check;

alter table public.players
  add constraint players_captain_roles_distinct_check
  check (not (is_captain is true and is_vice_captain is true));
