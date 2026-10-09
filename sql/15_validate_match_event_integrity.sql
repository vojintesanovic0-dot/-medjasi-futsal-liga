-- Guard match events at the database boundary, not only in app.js.
-- Prevents goals/cards for players who do not belong to either team in the match.
-- Existing data is checked before any NOT NULL constraints are applied.
begin;

do $preflight$
begin
  if exists (
    select 1 from public.goals
    where match_id is null or player_id is null
  ) then
    raise exception 'Cannot enforce goal identity: NULL match_id/player_id rows exist; correct them before retrying.';
  end if;

  if exists (
    select 1 from public.cards
    where match_id is null or player_id is null
  ) then
    raise exception 'Cannot enforce card identity: NULL match_id/player_id rows exist; correct them before retrying.';
  end if;

  if exists (
    select 1
    from public.goals g
    join public.matches m on m.id = g.match_id
    join public.players p on p.id = g.player_id
    where p.team_id is null
       or p.team_id not in (m.home_team_id, m.away_team_id)
  ) then
    raise exception 'Cannot enforce goal identity: goals by non-participant players exist; correct them before retrying.';
  end if;

  if exists (
    select 1
    from public.goals g
    join public.matches m on m.id = g.match_id
    join public.players p on p.id = g.assist_player_id
    where g.assist_player_id is not null
      and (p.team_id is null or p.team_id not in (m.home_team_id, m.away_team_id))
  ) then
    raise exception 'Cannot enforce assist identity: assists by non-participant players exist; correct them before retrying.';
  end if;

  if exists (
    select 1
    from public.cards c
    join public.matches m on m.id = c.match_id
    join public.players p on p.id = c.player_id
    where p.team_id is null
       or p.team_id not in (m.home_team_id, m.away_team_id)
  ) then
    raise exception 'Cannot enforce card identity: cards for non-participant players exist; correct them before retrying.';
  end if;
end;
$preflight$;

alter table public.goals
  alter column match_id set not null,
  alter column player_id set not null;

alter table public.cards
  alter column match_id set not null,
  alter column player_id set not null;

create or replace function private.medjasi_validate_match_event()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
declare
  v_home_team uuid;
  v_away_team uuid;
  v_player_team uuid;
  v_assist_team uuid;
begin
  -- Editing only the event time/type does not invalidate an already-recorded
  -- historical event if a player has subsequently changed clubs.
  if tg_op = 'UPDATE'
     and new.match_id is not distinct from old.match_id
     and new.player_id is not distinct from old.player_id then
    if tg_table_name <> 'goals' then
      return new;
    end if;
    if new.assist_player_id is not distinct from old.assist_player_id then
      return new;
    end if;
  end if;

  if new.match_id is null then
    raise exception 'Događaj mora pripadati utakmici.';
  end if;

  if new.player_id is null then
    raise exception 'Izaberi igrača za događaj.';
  end if;

  select m.home_team_id, m.away_team_id
    into v_home_team, v_away_team
  from public.matches m
  where m.id = new.match_id;

  if not found then
    raise exception 'Utakmica za ovaj događaj ne postoji.';
  end if;

  select p.team_id into v_player_team
  from public.players p
  where p.id = new.player_id;

  if not found or v_player_team is null then
    raise exception 'Igrač nije povezan s ekipom.';
  end if;

  if v_player_team not in (v_home_team, v_away_team) then
    raise exception 'Igrač ne pripada ekipama ove utakmice.';
  end if;

  if tg_table_name = 'goals' then
    if new.assist_player_id is not null then
      select p.team_id into v_assist_team
      from public.players p
      where p.id = new.assist_player_id;

      if not found or v_assist_team is null
         or v_assist_team not in (v_home_team, v_away_team) then
        raise exception 'Asistent mora pripadati jednoj od ekipa ove utakmice.';
      end if;
    end if;
  end if;

  return new;
end;
$function$;

revoke all on function private.medjasi_validate_match_event() from public, anon;
grant execute on function private.medjasi_validate_match_event() to authenticated;

drop trigger if exists trg_medjasi_validate_goal_match_participants on public.goals;
create trigger trg_medjasi_validate_goal_match_participants
before insert or update on public.goals
for each row execute function private.medjasi_validate_match_event();

drop trigger if exists trg_medjasi_validate_card_match_participants on public.cards;
create trigger trg_medjasi_validate_card_match_participants
before insert or update on public.cards
for each row execute function private.medjasi_validate_match_event();

commit;
