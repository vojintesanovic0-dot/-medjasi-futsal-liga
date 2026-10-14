-- Allow administrators to assign the dedicated content editor role.
-- Existing public.admin_set_user_role wrapper remains unchanged.
begin;

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

  if actor_role is distinct from 'admin' then
    raise exception 'Nemaš admin ovlaštenje.';
  end if;

  if target_user_id is null then
    raise exception 'Ciljni korisnik nije naveden.';
  end if;

  if new_role is null or new_role not in ('user', 'moderator', 'admin', 'editor') then
    raise exception 'Neispravna uloga.';
  end if;

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

commit;
