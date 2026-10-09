-- Enforce valid match identity/status and prevent opening markets after kickoff or finish.
begin;

do $preflight$
begin
  if exists (select 1 from public.matches where home_team_id is null or away_team_id is null) then
    raise exception 'Matches with missing home/away teams exist; fix them before enforcing required team IDs.';
  end if;
  if exists (select 1 from public.matches where status is null) then
    raise exception 'Matches with NULL status exist; assign scheduled/live/finished before applying this migration.';
  end if;
  if to_regprocedure('private.fan_generate_markets(text)') is null then
    raise exception 'private.fan_generate_markets(text) is missing; apply sql/01_fan_game.sql and sql/02_security_hardening.sql first.';
  end if;
  if to_regprocedure('public.fan_generate_markets(text)') is null then
    raise exception 'public.fan_generate_markets(text) wrapper is missing; restore the authenticated invoker wrapper first.';
  end if;
  if to_regprocedure('private.fan_reprice_match_odds(text)') is null then
    raise exception 'private.fan_reprice_match_odds(text) is missing; apply the Fan Game security hardening first.';
  end if;
end $preflight$;

alter table public.matches alter column home_team_id set not null;
alter table public.matches alter column away_team_id set not null;
alter table public.matches alter column status set default 'scheduled';
alter table public.matches alter column status set not null;

create or replace function private.fan_generate_markets(p_match text) returns int
language plpgsql security definer set search_path = public, pg_temp as $fan_market_guard$
declare mt record; n int := 0; r record; sc text; v_name text;
begin
  if not fan_is_admin() then raise exception 'Samo admin.'; end if;
  select * into mt from matches where id::text = p_match for update;
  if not found then raise exception 'Utakmica ne postoji.'; end if;
  if mt.status is null or mt.status not in ('scheduled','live') then raise exception 'Ne možeš kreirati kvote za utakmicu koja nije zakazana ili uživo.'; end if;
  if mt.status = 'scheduled' and mt.match_date is not null and mt.match_date <= now() then raise exception 'Utakmica je trebala početi. Kvote uživo se otvaraju kada utakmica počne.'; end if;
  if mt.status = 'live' and coalesce(mt.current_minute,0) >= 60 then raise exception 'Utakmica je završila. Nove kvote su zatvorene.'; end if;

  insert into fan_markets(match_id, kind, selection, label, odds) values
    (p_match,'result','1','Pobjeda domaćina',2.20),
    (p_match,'result','X','Neriješeno',3.40),
    (p_match,'result','2','Pobjeda gosta',2.20)
  on conflict do nothing;
  insert into fan_markets(match_id, kind, selection, label, line, odds) values
    (p_match,'total','over','Više od 3.5 golova',3.5,1.90),
    (p_match,'total','under','Manje od 3.5 golova',3.5,1.90)
  on conflict do nothing;
  insert into fan_markets(match_id, kind, selection, label, odds) values
    (p_match,'red_card','yes','Biće crvenog kartona',3.50),
    (p_match,'red_card','no','Neće biti crvenog kartona',1.25)
  on conflict do nothing;

  foreach sc in array array['1:0','0:1','1:1','2:0','0:2','2:1','1:2','2:2','3:1','1:3','3:2','2:3'] loop
    insert into fan_markets(match_id, kind, selection, label, odds)
      values (p_match, 'exact', sc, 'Tačan rezultat ' || sc, 8.00)
      on conflict do nothing;
  end loop;

  for r in select p.* from players p
           where p.team_id::text in (mt.home_team_id::text, mt.away_team_id::text) loop
    v_name := coalesce(to_jsonb(r)->>'name', to_jsonb(r)->>'full_name', to_jsonb(r)->>'player_name', 'Igrač');
    insert into fan_markets(match_id, kind, selection, label, player_id, odds)
      values (p_match,'scorer', r.id::text, v_name||' daje gol', r.id::text, 2.60) on conflict do nothing;
    insert into fan_markets(match_id, kind, selection, label, player_id, odds)
      values (p_match,'player_2plus', r.id::text, v_name||' daje 2+ gola', r.id::text, 7.00) on conflict do nothing;
  end loop;

  perform private.fan_reprice_match_odds(p_match);
  select count(*) into n from fan_markets where match_id = p_match;
  return n;
end $fan_market_guard$;

revoke all on function private.fan_generate_markets(text) from public, anon;
grant execute on function private.fan_generate_markets(text) to authenticated;

commit;
