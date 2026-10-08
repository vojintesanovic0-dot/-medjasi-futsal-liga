-- Fan Game odds repricing runtime synchronization.
-- Mirrors the live private repricing implementation and triggers.

begin;

create or replace function private.fan_reprice_match_event()
returns trigger
language plpgsql
security definer
set search_path = private, public, pg_temp
as $function$
begin
  if tg_table_name = 'matches' then
    perform private.fan_reprice_match(new.id::text);
  else
    perform private.fan_reprice_match(coalesce(new.match_id, old.match_id)::text);
  end if;
  return coalesce(new, old);
end;
$function$;

create or replace function private.fan_reprice_match_odds(p_match text)
returns void
language plpgsql
security definer
set search_path = private, public, pg_temp
as $function$
declare
  mt record;
  mk record;
  home_avg numeric := 1.5;
  away_avg numeric := 1.5;
  home_def numeric := 1.5;
  away_def numeric := 1.5;
  home_strength numeric := 1;
  away_strength numeric := 1;
  ph numeric;
  pd numeric;
  pa numeric;
  total numeric;
  minute numeric;
  hs int;
  aw int;
  red_home int;
  red_away int;
  score_adj numeric;
  p numeric;
  line numeric;
begin
  select * into mt from public.matches where id::text = p_match;
  if not found then return; end if;

  hs := coalesce(mt.home_score,0);
  aw := coalesce(mt.away_score,0);
  minute := greatest(0, least(60, coalesce(mt.current_minute,0)));

  select
    coalesce(avg(case when home_team_id = mt.home_team_id then home_score end),1.5),
    coalesce(avg(case when away_team_id = mt.away_team_id then away_score end),1.5),
    coalesce(avg(case when home_team_id = mt.home_team_id then away_score end),1.5),
    coalesce(avg(case when away_team_id = mt.away_team_id then home_score end),1.5)
  into home_avg, away_avg, home_def, away_def
  from public.matches
  where status='finished'
    and (home_team_id = mt.home_team_id
      or away_team_id = mt.home_team_id
      or home_team_id = mt.away_team_id
      or away_team_id = mt.away_team_id);

  home_strength := greatest(0.55, least(1.9, ((home_avg + away_def) / 3.0)));
  away_strength := greatest(0.55, least(1.9, ((away_avg + home_def) / 3.0)));

  ph := 0.43 * home_strength / greatest(0.75, home_strength + away_strength) + 0.08;
  pa := 0.43 * away_strength / greatest(0.75, home_strength + away_strength);
  pd := greatest(0.08, 1 - ph - pa);

  if mt.status='live' then
    score_adj := (hs-aw) * 0.12 + ((minute-30)/60.0) * 0.03;
    ph := greatest(0.04, least(0.92, ph + score_adj));
    pa := greatest(0.04, least(0.92, pa - score_adj));
    pd := greatest(0.04, 1-ph-pa);

    select count(*) filter (where p.team_id::text = mt.home_team_id::text),
           count(*) filter (where p.team_id::text = mt.away_team_id::text)
      into red_home, red_away
    from public.cards c
    join public.players p on p.id = c.player_id
    where c.match_id::text = p_match
      and lower(c.card_type)='red';

    if red_home > red_away then
      ph := greatest(0.03, ph-0.10);
      pa := least(0.94, pa+0.07);
      pd := greatest(0.03, 1-ph-pa);
    elsif red_away > red_home then
      pa := greatest(0.03, pa-0.10);
      ph := least(0.94, ph+0.07);
      pd := greatest(0.03, 1-ph-pa);
    end if;
  end if;

  total := ph+pd+pa;
  ph := ph/total;
  pd := pd/total;
  pa := pa/total;

  for mk in
    select * from public.fan_markets
    where match_id=p_match and status='open'
  loop
    p := null;

    if mk.kind='result' then
      p := case mk.selection when '1' then ph when 'X' then pd when '2' then pa end;
    elsif mk.kind='total' then
      line := coalesce(mk.line,3.5);
      p := case
        when mk.selection='over'
          then greatest(0.12, least(0.88, 0.50 + ((hs+aw)-line)*0.12 + minute*0.002))
        else greatest(0.12, least(0.88, 0.50 - ((hs+aw)-line)*0.12 - minute*0.002))
      end;
    elsif mk.kind='red_card' then
      select count(*) into red_home
      from public.cards
      where match_id::text=p_match
        and lower(card_type)='red';

      p := case
        when mk.selection='yes'
          then greatest(0.08, least(0.90, 0.22 + red_home*0.30 + minute*0.003))
        else greatest(0.10, least(0.92, 0.78 - red_home*0.30 - minute*0.003))
      end;
    elsif mk.kind='exact' then
      p := case when mk.selection = hs||':'||aw then 0.08 else 0.015 end;
    elsif mk.kind='scorer' then
      p := greatest(
        0.08,
        least(
          0.75,
          0.28 - minute*0.002 +
          coalesce((
            select count(*) from public.goals
            where match_id::text=p_match and player_id::text=mk.player_id
          ),0)*0.20
        )
      );
    elsif mk.kind='player_2plus' then
      p := greatest(
        0.02,
        least(
          0.35,
          0.10 - minute*0.001 +
          coalesce((
            select count(*) from public.goals
            where match_id::text=p_match and player_id::text=mk.player_id
          ),0)*0.10
        )
      );
    end if;

    if p is not null then
      update public.fan_markets
      set odds = round(greatest(1.05, least(100, (1.0/p)*1.05))::numeric, 2)
      where id=mk.id and status='open';
    end if;
  end loop;
end;
$function$;

revoke all on function private.fan_reprice_match_event() from public, anon, authenticated;
revoke all on function private.fan_reprice_match_odds(text) from public, anon, authenticated;

drop trigger if exists trg_fan_reprice_match on public.matches;
create trigger trg_fan_reprice_match
after update of home_score, away_score, current_minute, status
on public.matches
for each row execute function private.fan_reprice_match_event();

drop trigger if exists trg_fan_reprice_goal on public.goals;
create trigger trg_fan_reprice_goal
after insert or delete or update
on public.goals
for each row execute function private.fan_reprice_match_event();

drop trigger if exists trg_fan_reprice_card on public.cards;
create trigger trg_fan_reprice_card
after insert or delete or update
on public.cards
for each row execute function private.fan_reprice_match_event();

commit;
