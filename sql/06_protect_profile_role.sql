-- Security hardening: profile roles are server-controlled.
-- Ordinary clients may create their own profile with only id/username and may
-- update username/avatar_url/bio, but cannot write the authorization role.

begin;

revoke insert, update on table public.profiles from authenticated;
revoke insert, update on table public.profiles from anon;

grant insert (id, username) on table public.profiles to authenticated;
grant update (username, avatar_url, bio) on table public.profiles to authenticated;

-- Defense in depth: keep role escalation blocked even if table grants are
-- changed later. Admin role management continues through server-side admin code.
create or replace function public.prevent_profile_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.role is distinct from old.role and not coalesce(public.is_admin(), false) then
    raise exception 'Nemaš dozvolu da mijenjaš ulogu korisnika.';
  end if;
  return new;
end;
$$;

revoke all on function public.prevent_profile_role_escalation() from public, anon, authenticated;

drop trigger if exists profiles_prevent_role_escalation on public.profiles;
create trigger profiles_prevent_role_escalation
before update on public.profiles
for each row
execute function public.prevent_profile_role_escalation();

-- The frontend calls these admin-only RPC endpoints as authenticated users.
-- The functions themselves enforce administrator authorization.
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

-- Fan Game settlement is owned by the existing public.medjasi_match_event trigger.
-- Keeping a single settlement path avoids duplicate processing on match finish.

-- Fan Game settlement integrity:
-- once a finished match has at least one ticket, goals/cards/lineup changes
-- must not retroactively invalidate the already-settled result.
create or replace function private.fan_block_settled_match_edit()
returns trigger
language plpgsql
security definer
set search_path = private, public, pg_temp
as $$
declare
  v_match text;
begin
  if tg_op = 'INSERT' then
    v_match := new.match_id::text;
  elsif tg_op = 'DELETE' then
    v_match := old.match_id::text;
  else
    v_match := coalesce(new.match_id::text, old.match_id::text);
  end if;

  if exists (
    select 1 from public.matches m
    where m.id::text = v_match
      and m.status = 'finished'
  )
  and exists (
    select 1 from public.fan_picks fp
    where fp.match_id = v_match
  ) then
    raise exception 'Utakmica je zaključana jer je Fan Game već obračunat. Korekcija događaja nije dozvoljena.';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function private.fan_block_settled_match_edit() from public, anon, authenticated;

drop trigger if exists trg_fan_block_finished_goal_edit on public.goals;
create trigger trg_fan_block_finished_goal_edit
before insert or update or delete on public.goals
for each row execute function private.fan_block_settled_match_edit();

drop trigger if exists trg_fan_block_finished_card_edit on public.cards;
create trigger trg_fan_block_finished_card_edit
before insert or update or delete on public.cards
for each row execute function private.fan_block_settled_match_edit();

drop trigger if exists trg_fan_block_finished_lineup_edit on public.match_players;
create trigger trg_fan_block_finished_lineup_edit
before insert or update or delete on public.match_players
for each row execute function private.fan_block_settled_match_edit();

-- Privileged SECURITY DEFINER routines use an explicit pg_temp tail.
alter function public._medjasi_require_admin() set search_path = public, pg_temp;
alter function public.admin_set_user_role(uuid,text) set search_path = public, pg_temp;
alter function public.delete_card_admin(uuid) set search_path = public, pg_temp;
alter function public.delete_comment_admin(uuid) set search_path = public, pg_temp;
alter function public.delete_gallery_admin(uuid) set search_path = public, pg_temp;
alter function public.delete_goal_admin(uuid) set search_path = public, pg_temp;
alter function public.delete_match_admin(uuid) set search_path = public, pg_temp;
alter function public.delete_message_admin(uuid) set search_path = public, pg_temp;
alter function public.delete_player_admin(uuid) set search_path = public, pg_temp;
alter function public.delete_team_admin(uuid) set search_path = public, pg_temp;
alter function public.medjasi_goal_event() set search_path = public, pg_temp;
alter function public.medjasi_match_event() set search_path = public, pg_temp;
alter function public.prevent_profile_role_escalation() set search_path = public, pg_temp;
alter function public.protect_profile_role() set search_path = public, pg_temp;
alter function public.update_match_admin(uuid,uuid,uuid,timestamptz,text) set search_path = public, pg_temp;
alter function public.update_player_admin(uuid,text,uuid,integer,text,boolean) set search_path = public, pg_temp;

commit;
