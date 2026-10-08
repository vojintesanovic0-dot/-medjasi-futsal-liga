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

commit;
