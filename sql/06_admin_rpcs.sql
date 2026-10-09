-- Admin RPCs used by the frontend.
--
-- These functions are intentionally SECURITY DEFINER because they need to
-- perform multi-table cleanup and/or privileged updates. Access is limited
-- by explicit admin checks inside the functions and by EXECUTE grants only to
-- authenticated users and service_role.

begin;

-- Canonical admin predicate: safe for missing profiles and non-admin users.
create or replace function public.medjasi_is_admin()
returns boolean
language sql
stable
security invoker
set search_path = public, pg_temp
as $function$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$function$;
revoke all on function public.medjasi_is_admin() from public, anon;
grant execute on function public.medjasi_is_admin() to authenticated, service_role;

create or replace function public.admin_set_user_role(target_user_id uuid, new_role text)
returns void
language plpgsql
security definer
set search_path to public, pg_temp
as $function$
declare
  actor_role text;
begin
  select role
    into actor_role
  from public.profiles
  where id = auth.uid();

  if actor_role is distinct from 'admin' then
    raise exception 'Nemaš admin ovlaštenje.';
  end if;

  if new_role is null or new_role not in ('user', 'moderator', 'admin') then
    raise exception 'Neispravna uloga.';
  end if;

  update public.profiles
     set role = new_role
   where id = target_user_id;
end;
$function$;

create or replace function public.delete_team_admin(team_uuid uuid)
returns void
language plpgsql
security definer
set search_path to public, pg_temp
as $function$
declare
  match_ids uuid[];
begin
  if not public.medjasi_is_admin() then
    raise exception 'Nemaš admin ovlaštenje.';
  end if;

  select array_agg(id)
    into match_ids
  from public.matches
  where home_team_id = team_uuid
     or away_team_id = team_uuid;

  if match_ids is not null then
    delete from public.goals
     where match_id = any(match_ids);

    delete from public.cards
     where match_id = any(match_ids);

    delete from public.match_substitutions
     where match_id = any(match_ids);

    delete from public.match_player_stats
     where match_id = any(match_ids);

    delete from public.match_players
     where match_id = any(match_ids);

    delete from public.matches
     where id = any(match_ids);
  end if;

  delete from public.players
   where team_id = team_uuid;

  delete from public.teams
   where id = team_uuid;
end;
$function$;

create or replace function public.delete_player_admin(player_uuid uuid)
returns void
language plpgsql
security definer
set search_path to public, pg_temp
as $function$
begin
  if not public.medjasi_is_admin() then
    raise exception 'Nemaš admin ovlaštenje.';
  end if;

  delete from public.goals
   where player_id = player_uuid
      or assist_player_id = player_uuid;

  delete from public.cards
   where player_id = player_uuid;

  delete from public.match_substitutions
   where player_out_id = player_uuid
      or player_in_id = player_uuid;

  delete from public.match_player_stats
   where player_id = player_uuid;

  delete from public.match_players
   where player_id = player_uuid;

  delete from public.players
   where id = player_uuid;
end;
$function$;

create or replace function public.delete_match_admin(match_uuid uuid)
returns void
language plpgsql
security definer
set search_path to public, pg_temp
as $function$
begin
  if not public.medjasi_is_admin() then
    raise exception 'Nemaš admin ovlaštenje.';
  end if;

  delete from public.goals
   where match_id = match_uuid;

  delete from public.cards
   where match_id = match_uuid;

  delete from public.match_substitutions
   where match_id = match_uuid;

  delete from public.match_player_stats
   where match_id = match_uuid;

  delete from public.match_players
   where match_id = match_uuid;

  delete from public.matches
   where id = match_uuid;
end;
$function$;

create or replace function public.delete_goal_admin(goal_uuid uuid)
returns void
language plpgsql
security definer
set search_path to public, pg_temp
as $function$
begin
  if not public.medjasi_is_admin() then
    raise exception 'Nemaš admin ovlaštenje.';
  end if;

  delete from public.goals
   where id = goal_uuid;
end;
$function$;

create or replace function public.delete_card_admin(card_uuid uuid)
returns void
language plpgsql
security definer
set search_path to public, pg_temp
as $function$
begin
  if not public.medjasi_is_admin() then
    raise exception 'Nemaš admin ovlaštenje.';
  end if;

  delete from public.cards
   where id = card_uuid;
end;
$function$;

create or replace function public.delete_comment_admin(comment_uuid uuid)
returns void
language plpgsql
security definer
set search_path to public, pg_temp
as $function$
begin
  if not public.medjasi_is_admin() then
    raise exception 'Nemaš admin ovlaštenje.';
  end if;

  delete from public.comments
   where id = comment_uuid;
end;
$function$;

create or replace function public.delete_message_admin(message_uuid uuid)
returns void
language plpgsql
security definer
set search_path to public, pg_temp
as $function$
begin
  if not public.medjasi_is_admin() then
    raise exception 'Nemaš admin ovlaštenje.';
  end if;

  delete from public.messages
   where id = message_uuid;
end;
$function$;

create or replace function public.delete_gallery_admin(gallery_uuid uuid)
returns void
language plpgsql
security definer
set search_path to public, pg_temp
as $function$
begin
  if not public.medjasi_is_admin() then
    raise exception 'Nemaš admin ovlaštenje.';
  end if;

  delete from public.gallery
   where id = gallery_uuid;
end;
$function$;

create or replace function public.update_match_admin(
  match_uuid uuid,
  new_home_team_id uuid,
  new_away_team_id uuid,
  new_match_date timestamptz,
  new_round text
)
returns void
language plpgsql
security definer
set search_path to public, pg_temp
as $function$
begin
  if not public.medjasi_is_admin() then
    raise exception 'Nemaš admin ovlaštenje.';
  end if;

  if new_home_team_id = new_away_team_id then
    raise exception 'Domaćin i gost ne mogu biti ista ekipa.';
  end if;

  update public.matches
     set home_team_id = new_home_team_id,
         away_team_id = new_away_team_id,
         match_date = new_match_date,
         round = nullif(trim(new_round), ''),
         updated_at = now()
   where id = match_uuid;
end;
$function$;


create or replace function public.update_player_admin(
  player_uuid uuid,
  new_name text,
  new_team_id uuid,
  new_jersey_number integer,
  new_position text,
  new_is_captain boolean
)
returns void
language plpgsql
security definer
set search_path to public, pg_temp
as $function$
begin
  if not public.medjasi_is_admin() then
    raise exception 'Nemaš admin ovlaštenje.';
  end if;

  if nullif(trim(new_name), '') is null then
    raise exception 'Ime igrača je obavezno.';
  end if;

  if new_team_id is null
     or not exists (select 1 from public.teams where id = new_team_id)
  then
    raise exception 'Izabrana ekipa ne postoji.';
  end if;

  if new_jersey_number is not null and new_jersey_number < 0 then
    raise exception 'Broj igrača ne može biti negativan.';
  end if;

  if coalesce(new_is_captain, false) then
    update public.players
       set is_captain = false
     where team_id = new_team_id
       and id <> player_uuid;
  end if;

  update public.players
     set name = trim(new_name),
         team_id = new_team_id,
         jersey_number = new_jersey_number,
         position = nullif(trim(new_position), ''),
         is_captain = coalesce(new_is_captain, false)
   where id = player_uuid;

  if not found then
    raise exception 'Igrač nije pronađen.';
  end if;
end;
$function$;

revoke execute on function public.admin_set_user_role(uuid, text) from public, anon;
revoke execute on function public.delete_team_admin(uuid) from public, anon;
revoke execute on function public.delete_player_admin(uuid) from public, anon;
revoke execute on function public.delete_match_admin(uuid) from public, anon;
revoke execute on function public.delete_goal_admin(uuid) from public, anon;
revoke execute on function public.delete_card_admin(uuid) from public, anon;
revoke execute on function public.delete_comment_admin(uuid) from public, anon;
revoke execute on function public.delete_message_admin(uuid) from public, anon;
revoke execute on function public.delete_gallery_admin(uuid) from public, anon;
revoke execute on function public.update_match_admin(uuid, uuid, uuid, timestamptz, text) from public, anon;
revoke execute on function public.update_player_admin(uuid, text, uuid, integer, text, boolean) from public, anon;

grant execute on function public.admin_set_user_role(uuid, text) to authenticated, service_role;
grant execute on function public.delete_team_admin(uuid) to authenticated, service_role;
grant execute on function public.delete_player_admin(uuid) to authenticated, service_role;
grant execute on function public.delete_match_admin(uuid) to authenticated, service_role;
grant execute on function public.delete_goal_admin(uuid) to authenticated, service_role;
grant execute on function public.delete_card_admin(uuid) to authenticated, service_role;
grant execute on function public.delete_comment_admin(uuid) to authenticated, service_role;
grant execute on function public.delete_message_admin(uuid) to authenticated, service_role;
grant execute on function public.delete_gallery_admin(uuid) to authenticated, service_role;
grant execute on function public.update_match_admin(uuid, uuid, uuid, timestamptz, text) to authenticated, service_role;
grant execute on function public.update_player_admin(uuid, text, uuid, integer, text, boolean) to authenticated, service_role;

commit;
