-- Non-breaking data integrity guards. Existing live data was checked
-- before adding these constraints.

begin;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid='public.goals'::regclass and conname='goals_minute_range_check') then
    alter table public.goals add constraint goals_minute_range_check check (minute is null or minute between 0 and 60);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.goals'::regclass and conname='goals_second_range_check') then
    alter table public.goals add constraint goals_second_range_check check (second is null or second between 0 and 59);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.goals'::regclass and conname='goals_assist_not_scorer_check') then
    alter table public.goals add constraint goals_assist_not_scorer_check check (assist_player_id is null or assist_player_id <> player_id);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.matches'::regclass and conname='matches_nonnegative_scores_check') then
    alter table public.matches add constraint matches_nonnegative_scores_check check ((home_score is null or home_score >= 0) and (away_score is null or away_score >= 0));
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.players'::regclass and conname='players_nonnegative_jersey_check') then
    alter table public.players add constraint players_nonnegative_jersey_check check (jersey_number is null or jersey_number >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.matches'::regclass and conname='matches_distinct_teams_check') then
    alter table public.matches add constraint matches_distinct_teams_check check (home_team_id is null or away_team_id is null or home_team_id <> away_team_id);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.matches'::regclass and conname='matches_status_check') then
    alter table public.matches add constraint matches_status_check check (status is null or status in ('scheduled','live','finished'));
  end if;
end $$;

commit;
