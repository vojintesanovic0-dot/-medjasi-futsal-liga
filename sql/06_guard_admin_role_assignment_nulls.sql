-- Security fix: reject missing identities, missing roles and invalid targets.
-- This mirrors the applied Supabase migration guard_admin_role_assignment_nulls.
-- Keep the existing public SECURITY INVOKER wrapper and all role-management UI.

begin;

-- Make this script safe for a clean install as well as an existing database.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.admin_set_user_role(
  target_user_id uuid,
  new_role text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  actor_id uuid := auth.uid();
  actor_role text;
  admin_count integer;
begin
  if actor_id is null then
    raise exception 'Prijavi se.';
  end if;

  select p.role
    into actor_role
  from public.profiles p
  where p.id = actor_id;

  -- IS DISTINCT FROM is intentional: unlike <> it also rejects NULL.
  if actor_role is distinct from 'admin' then
    raise exception 'Nemaš admin ovlaštenje.';
  end if;

  if target_user_id is null then
    raise exception 'Ciljni korisnik nije naveden.';
  end if;

  if new_role is null or new_role not in ('user', 'moderator', 'admin') then
    raise exception 'Neispravna uloga.';
  end if;

  -- Do not accidentally remove the final administrator.
  if target_user_id = actor_id and new_role <> 'admin' then
    select count(*) into admin_count
    from public.profiles
    where role = 'admin';

    if admin_count <= 1 then
      raise exception 'Ne možeš ukloniti ulogu posljednjem administratoru.';
    end if;
  end if;

  update public.profiles
  set role = new_role
  where id = target_user_id;

  if not found then
    raise exception 'Ciljni korisnik nema profil.';
  end if;
end;
$function$;

-- The public API remains an invoker wrapper; privileged logic stays private.
create or replace function public.admin_set_user_role(
  target_user_id uuid,
  new_role text
)
returns void
language sql
security invoker
set search_path = public, pg_temp
as $function$
  select private.admin_set_user_role(target_user_id, new_role);
$function$;

revoke all on function private.admin_set_user_role(uuid, text) from public, anon;
grant execute on function private.admin_set_user_role(uuid, text) to authenticated;
revoke all on function public.admin_set_user_role(uuid, text) from public, anon;
grant execute on function public.admin_set_user_role(uuid, text) to authenticated;

commit;
