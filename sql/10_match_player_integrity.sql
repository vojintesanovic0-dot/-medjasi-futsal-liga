-- Match lineup integrity.
-- A player must belong to one of the teams in the match.
-- A team cannot have more than five starting players.

begin;

create or replace function public.validate_match_player_assignment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  player_team uuid;
  home_team uuid;
  away_team uuid;
  starting_count integer;
begin
  select team_id into player_team
  from public.players
  where id = new.player_id;

  select home_team_id, away_team_id
    into home_team, away_team
  from public.matches
  where id = new.match_id;

  if player_team is null
     or (home_team is null and away_team is null)
     or (player_team <> home_team and player_team <> away_team)
  then
    raise exception 'Igrač ne pripada ekipama ove utakmice.';
  end if;

  if coalesce(new.is_starting, false) then
    select count(*) into starting_count
    from public.match_players mp
    join public.players p on p.id = mp.player_id
    where mp.match_id = new.match_id
      and coalesce(mp.is_starting, false)
      and p.team_id = player_team
      and mp.id <> new.id;

    if starting_count >= 5 then
      raise exception 'Početna petorka ne može imati više od 5 igrača.';
    end if;
  end if;

  return new;
end;
$function$;

revoke all on function public.validate_match_player_assignment() from public, anon, authenticated;

drop trigger if exists trg_validate_match_player_assignment on public.match_players;
create trigger trg_validate_match_player_assignment
before insert or update on public.match_players
for each row execute function public.validate_match_player_assignment();

commit;
