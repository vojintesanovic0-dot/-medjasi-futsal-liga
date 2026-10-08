-- Runtime event/backend synchronization.
-- This file mirrors the live Supabase trigger functions used by the app
-- for Goal -> score -> league event -> Community/Chat and
-- Match finish -> league event -> Fan Game settlement.

begin;

create or replace function public.medjasi_goal_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  m record;
  p record;
  t record;
  admin_id uuid;
  v_home_score integer;
  v_away_score integer;
  title_text text;
  body_text text;
  image text;
begin
  select * into m from public.matches where id = new.match_id;
  if not found then return new; end if;

  select * into p from public.players where id = new.player_id;
  select * into t from public.teams where id = p.team_id;
  select id into admin_id
  from public.profiles
  where role = 'admin'
  order by id
  limit 1;

  select count(*) into v_home_score
  from public.goals g
  join public.players gp on gp.id = g.player_id
  where g.match_id = new.match_id
    and gp.team_id = m.home_team_id;

  select count(*) into v_away_score
  from public.goals g
  join public.players gp on gp.id = g.player_id
  where g.match_id = new.match_id
    and gp.team_id = m.away_team_id;

  update public.matches
  set home_score = v_home_score,
      away_score = v_away_score
  where id = new.match_id;

  title_text := '⚽ GOL — ' || coalesce(t.name, 'Igrač');
  body_text := coalesce(p.name, 'Igrač') || ' ' ||
               v_home_score || ':' || v_away_score || ' · ' ||
               coalesce(m.current_minute, new.minute, 0) || '''';

  insert into public.league_events(
    event_type, match_id, goal_id, player_id, team_id, title, body
  )
  values (
    'goal', new.match_id, new.id, new.player_id, p.team_id,
    title_text, body_text
  );

  if admin_id is not null then
    image := coalesce(
      p.photo_url,
      t.logo_url,
      'https://via.placeholder.com/600x600?text=Medjasi+Futsal'
    );

    insert into public.community_posts(
      user_id, image_url, caption, match_id, team_id, player_id
    )
    values (
      admin_id, image, title_text || E'\n' || body_text,
      new.match_id, p.team_id, new.player_id
    );

    insert into public.messages(
      user_id, username, content, image_url
    )
    select
      admin_id,
      coalesce(pr.username, 'Liga'),
      title_text || ' · ' || body_text,
      image
    from public.profiles pr
    where pr.id = admin_id;
  end if;

  return new;
end;
$function$;

create or replace function public.medjasi_match_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  admin_id uuid;
  hn text;
  an text;
  title_text text;
  body_text text;
begin
  if new.status = 'finished'
     and old.status is distinct from 'finished'
  then
    select id into admin_id
    from public.profiles
    where role = 'admin'
    order by id
    limit 1;

    select name into hn from public.teams where id = new.home_team_id;
    select name into an from public.teams where id = new.away_team_id;

    title_text := '🏁 KRAJ — ' ||
      coalesce(hn, 'Domaćin') || ' ' ||
      coalesce(new.home_score, 0) || ':' ||
      coalesce(new.away_score, 0) || ' ' ||
      coalesce(an, 'Gost');

    body_text := 'Utakmica je završena.';

    insert into public.league_events(
      event_type, match_id, title, body
    )
    values (
      'match_finished', new.id, title_text, body_text
    );

    if admin_id is not null then
      insert into public.community_posts(
        user_id, image_url, caption, match_id, team_id
      )
      values (
        admin_id,
        coalesce(
          (select logo_url from public.teams where id = new.home_team_id),
          'https://via.placeholder.com/600x600?text=Medjasi+Futsal'
        ),
        title_text || E'\n' || body_text,
        new.id,
        new.home_team_id
      );

      insert into public.messages(
        user_id, username, content, image_url
      )
      select
        admin_id,
        coalesce(pr.username, 'Liga'),
        title_text || ' · ' || body_text,
        coalesce(
          (select logo_url from public.teams where id = new.home_team_id),
          'https://via.placeholder.com/600x600?text=Medjasi+Futsal'
        )
      from public.profiles pr
      where pr.id = admin_id;
    end if;

    perform private.fan_settle_match(new.id::text);
  end if;

  return new;
end;
$function$;

create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  if auth.uid() is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.role in ('admin', 'moderator')
       and not coalesce(public.is_admin(), false)
    then
      raise exception
        'Nedozvoljeno: ne možeš sebi dodijeliti ulogu %',
        new.role;
    end if;

  elsif tg_op = 'UPDATE' then
    if new.role is distinct from old.role
       and not coalesce(public.is_admin(), false)
    then
      raise exception
        'Nedozvoljeno: ulogu može mijenjati samo administrator';
    end if;
  end if;

  return new;
end;
$function$;

revoke all on function public.medjasi_goal_event() from public, anon, authenticated;
revoke all on function public.medjasi_match_event() from public, anon, authenticated;
revoke all on function public.protect_profile_role() from public, anon, authenticated;

drop trigger if exists medjasi_goal_event on public.goals;
create trigger medjasi_goal_event
after insert on public.goals
for each row execute function public.medjasi_goal_event();

drop trigger if exists medjasi_match_event on public.matches;
create trigger medjasi_match_event
after update on public.matches
for each row execute function public.medjasi_match_event();

drop trigger if exists trg_protect_profile_role on public.profiles;
create trigger trg_protect_profile_role
before insert or update on public.profiles
for each row execute function public.protect_profile_role();

commit;
