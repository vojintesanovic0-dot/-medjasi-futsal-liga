-- Keep match scores consistent when a goal or team assignment changes.
-- The INSERT path remains handled by public.medjasi_goal_event(); these triggers
-- cover UPDATE/DELETE and team reassignment without duplicating goal notifications.

begin;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.medjasi_recalculate_match_score(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  if p_match_id is null then
    return;
  end if;

  update public.matches m
  set
    home_score = coalesce((
      select count(*)::integer
      from public.goals g
      join public.players p on p.id = g.player_id
      where g.match_id = m.id
        and p.team_id = m.home_team_id
    ), 0),
    away_score = coalesce((
      select count(*)::integer
      from public.goals g
      join public.players p on p.id = g.player_id
      where g.match_id = m.id
        and p.team_id = m.away_team_id
    ), 0)
  where m.id = p_match_id;
end;
$function$;

create or replace function private.medjasi_recalculate_match_score_after_goal_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  old_match_id uuid;
  new_match_id uuid;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    old_match_id := old.match_id;
  end if;

  if tg_op = 'UPDATE' then
    new_match_id := new.match_id;
  end if;

  if old_match_id is not null then
    perform private.medjasi_recalculate_match_score(old_match_id);
  end if;

  if new_match_id is not null and new_match_id is distinct from old_match_id then
    perform private.medjasi_recalculate_match_score(new_match_id);
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$function$;

create or replace function private.medjasi_recalculate_match_score_after_player_team_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  affected_match_id uuid;
begin
  if new.team_id is not distinct from old.team_id then
    return new;
  end if;

  for affected_match_id in
    select distinct g.match_id
    from public.goals g
    where g.player_id = new.id
      and g.match_id is not null
  loop
    perform private.medjasi_recalculate_match_score(affected_match_id);
  end loop;

  return new;
end;
$function$;

create or replace function private.medjasi_recalculate_match_score_after_match_team_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  if new.home_team_id is distinct from old.home_team_id
     or new.away_team_id is distinct from old.away_team_id then
    perform private.medjasi_recalculate_match_score(new.id);
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_medjasi_recalculate_score_after_goal_change on public.goals;
create trigger trg_medjasi_recalculate_score_after_goal_change
after update or delete on public.goals
for each row
execute function private.medjasi_recalculate_match_score_after_goal_change();

drop trigger if exists trg_medjasi_recalculate_score_after_player_team_change on public.players;
create trigger trg_medjasi_recalculate_score_after_player_team_change
after update of team_id on public.players
for each row
execute function private.medjasi_recalculate_match_score_after_player_team_change();

drop trigger if exists trg_medjasi_recalculate_score_after_match_team_change on public.matches;
create trigger trg_medjasi_recalculate_score_after_match_team_change
after update of home_team_id, away_team_id on public.matches
for each row
execute function private.medjasi_recalculate_match_score_after_match_team_change();

revoke all on function private.medjasi_recalculate_match_score(uuid) from public, anon, authenticated;
revoke all on function private.medjasi_recalculate_match_score_after_goal_change() from public, anon, authenticated;
revoke all on function private.medjasi_recalculate_match_score_after_player_team_change() from public, anon, authenticated;
revoke all on function private.medjasi_recalculate_match_score_after_match_team_change() from public, anon, authenticated;

commit;
