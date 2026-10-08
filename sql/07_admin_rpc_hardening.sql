-- Admin RPC hardening.
-- Keep public RPC names for the existing Admin UI, but move privileged
-- SECURITY DEFINER implementations into the private schema.

begin;

alter function public.admin_set_user_role(uuid,text) set schema private;
alter function public.delete_card_admin(uuid) set schema private;
alter function public.delete_comment_admin(uuid) set schema private;
alter function public.delete_gallery_admin(uuid) set schema private;
alter function public.delete_goal_admin(uuid) set schema private;
alter function public.delete_match_admin(uuid) set schema private;
alter function public.delete_message_admin(uuid) set schema private;
alter function public.delete_player_admin(uuid) set schema private;
alter function public.delete_team_admin(uuid) set schema private;
alter function public.update_match_admin(uuid,uuid,uuid,timestamptz,text) set schema private;
alter function public.update_player_admin(uuid,text,uuid,integer,text,boolean) set schema private;

revoke all on function private.admin_set_user_role(uuid,text) from public, anon;
revoke all on function private.delete_card_admin(uuid) from public, anon;
revoke all on function private.delete_comment_admin(uuid) from public, anon;
revoke all on function private.delete_gallery_admin(uuid) from public, anon;
revoke all on function private.delete_goal_admin(uuid) from public, anon;
revoke all on function private.delete_match_admin(uuid) from public, anon;
revoke all on function private.delete_message_admin(uuid) from public, anon;
revoke all on function private.delete_player_admin(uuid) from public, anon;
revoke all on function private.delete_team_admin(uuid) from public, anon;
revoke all on function private.update_match_admin(uuid,uuid,uuid,timestamptz,text) from public, anon;
revoke all on function private.update_player_admin(uuid,text,uuid,integer,text,boolean) from public, anon;

grant execute on function private.admin_set_user_role(uuid,text) to authenticated;
grant execute on function private.delete_card_admin(uuid) to authenticated;
grant execute on function private.delete_comment_admin(uuid) to authenticated;
grant execute on function private.delete_gallery_admin(uuid) to authenticated;
grant execute on function private.delete_goal_admin(uuid) to authenticated;
grant execute on function private.delete_match_admin(uuid) to authenticated;
grant execute on function private.delete_message_admin(uuid) to authenticated;
grant execute on function private.delete_player_admin(uuid) to authenticated;
grant execute on function private.delete_team_admin(uuid) to authenticated;
grant execute on function private.update_match_admin(uuid,uuid,uuid,timestamptz,text) to authenticated;
grant execute on function private.update_player_admin(uuid,text,uuid,integer,text,boolean) to authenticated;

create or replace function public.admin_set_user_role(target_user_id uuid,new_role text)
returns void language sql security invoker set search_path=public,pg_temp
as $$ select private.admin_set_user_role(target_user_id,new_role); $$;

create or replace function public.delete_card_admin(card_uuid uuid)
returns void language sql security invoker set search_path=public,pg_temp
as $$ select private.delete_card_admin(card_uuid); $$;

create or replace function public.delete_comment_admin(comment_uuid uuid)
returns void language sql security invoker set search_path=public,pg_temp
as $$ select private.delete_comment_admin(comment_uuid); $$;

create or replace function public.delete_gallery_admin(gallery_uuid uuid)
returns void language sql security invoker set search_path=public,pg_temp
as $$ select private.delete_gallery_admin(gallery_uuid); $$;

create or replace function public.delete_goal_admin(goal_uuid uuid)
returns void language sql security invoker set search_path=public,pg_temp
as $$ select private.delete_goal_admin(goal_uuid); $$;

create or replace function private.delete_match_admin(match_uuid uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  perform public._medjasi_require_admin();

  if not exists (select 1 from public.matches where id = match_uuid) then
    raise exception 'Utakmica nije pronađena.';
  end if;

  if exists (
    select 1 from public.fan_markets
    where match_id::text = match_uuid::text
  ) or exists (
    select 1
    from public.fan_picks fp
    join public.fan_markets fm on fm.id = fp.market_id
    where fm.match_id::text = match_uuid::text
  ) then
    raise exception 'Utakmica se ne može obrisati jer sadrži Fan Game markete ili tikete.';
  end if;

  delete from public.match_players where match_id = match_uuid;
  delete from public.goals where match_id = match_uuid;
  delete from public.cards where match_id = match_uuid;
  delete from public.matches where id = match_uuid;
end;
$function$;

create or replace function public.delete_match_admin(match_uuid uuid)
returns void language sql security invoker set search_path=public,pg_temp
as $$ select private.delete_match_admin(match_uuid); $$;

create or replace function public.delete_message_admin(message_uuid uuid)
returns void language sql security invoker set search_path=public,pg_temp
as $$ select private.delete_message_admin(message_uuid); $$;

create or replace function public.delete_player_admin(player_uuid uuid)
returns void language sql security invoker set search_path=public,pg_temp
as $$ select private.delete_player_admin(player_uuid); $$;

create or replace function public.delete_team_admin(team_uuid uuid)
returns void language sql security invoker set search_path=public,pg_temp
as $$ select private.delete_team_admin(team_uuid); $$;

create or replace function private.delete_team_admin(team_uuid uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  match_ids uuid[];
begin
  perform public._medjasi_require_admin();

  if exists (
    select 1
    from public.matches m
    where (m.home_team_id = team_uuid or m.away_team_id = team_uuid)
      and exists (
        select 1 from public.fan_markets fm
        where fm.match_id::text = m.id::text
      )
  ) then
    raise exception 'Ekipa se ne može obrisati jer njene utakmice sadrže Fan Game markete ili tikete.';
  end if;

  select array_agg(id) into match_ids
  from public.matches
  where home_team_id = team_uuid or away_team_id = team_uuid;

  if match_ids is not null then
    delete from public.match_players where match_id = any(match_ids);
    delete from public.goals where match_id = any(match_ids);
    delete from public.cards where match_id = any(match_ids);
    delete from public.matches where id = any(match_ids);
  end if;

  delete from public.players where team_id = team_uuid;
  delete from public.teams where id = team_uuid;
end;
$function$;

create or replace function private.delete_player_admin(player_uuid uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  perform public._medjasi_require_admin();

  if not exists (select 1 from public.players where id = player_uuid) then
    raise exception 'Igrač nije pronađen.';
  end if;

  if exists (
    select 1 from public.fan_markets fm
    where fm.player_id::text = player_uuid::text
  ) then
    raise exception 'Igrač se ne može obrisati jer postoji Fan Game market vezan za tog igrača.';
  end if;

  delete from public.goals where player_id = player_uuid;
  delete from public.cards where player_id = player_uuid;
  delete from public.match_players where player_id = player_uuid;
  delete from public.players where id = player_uuid;
end;
$function$;

create or replace function public.update_match_admin(match_uuid uuid,new_home_team_id uuid,new_away_team_id uuid,new_match_date timestamptz,new_round text)
returns void language sql security invoker set search_path=public,pg_temp
as $$ select private.update_match_admin(match_uuid,new_home_team_id,new_away_team_id,new_match_date,new_round); $$;

create or replace function public.update_player_admin(player_uuid uuid,new_name text,new_team_id uuid,new_jersey_number integer,new_position text,new_is_captain boolean)
returns void language sql security invoker set search_path=public,pg_temp
as $$ select private.update_player_admin(player_uuid,new_name,new_team_id,new_jersey_number,new_position,new_is_captain); $$;

revoke all on function public.admin_set_user_role(uuid,text) from public,anon;
revoke all on function public.delete_card_admin(uuid) from public,anon;
revoke all on function public.delete_comment_admin(uuid) from public,anon;
revoke all on function public.delete_gallery_admin(uuid) from public,anon;
revoke all on function public.delete_goal_admin(uuid) from public,anon;
revoke all on function public.delete_match_admin(uuid) from public,anon;
revoke all on function public.delete_message_admin(uuid) from public,anon;
revoke all on function public.delete_player_admin(uuid) from public,anon;
revoke all on function public.delete_team_admin(uuid) from public,anon;
revoke all on function public.update_match_admin(uuid,uuid,uuid,timestamptz,text) from public,anon;
revoke all on function public.update_player_admin(uuid,text,uuid,integer,text,boolean) from public,anon;

grant execute on function public.admin_set_user_role(uuid,text) to authenticated;
grant execute on function public.delete_card_admin(uuid) to authenticated;
grant execute on function public.delete_comment_admin(uuid) to authenticated;
grant execute on function public.delete_gallery_admin(uuid) to authenticated;
grant execute on function public.delete_goal_admin(uuid) to authenticated;
grant execute on function public.delete_match_admin(uuid) to authenticated;
grant execute on function public.delete_message_admin(uuid) to authenticated;
grant execute on function public.delete_player_admin(uuid) to authenticated;
grant execute on function public.delete_team_admin(uuid) to authenticated;
grant execute on function public.update_match_admin(uuid,uuid,uuid,timestamptz,text) to authenticated;
grant execute on function public.update_player_admin(uuid,text,uuid,integer,text,boolean) to authenticated;

commit;
