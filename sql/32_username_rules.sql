-- 31: Enforce public username rules for profile rows.
-- Existing profiles were inspected before applying; current rows comply.
begin;

create or replace function public.handle_new_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  base_username text;
  candidate_username text;
  attempt integer := 0;
begin
  base_username := left(
    regexp_replace(coalesce(new.raw_user_meta_data ->> 'username', ''), '[^[:alnum:]_.-]', '', 'g'),
    30
  );

  if length(coalesce(base_username, '')) < 3
     or lower(base_username) in ('admin','moderator','medjasi','liga','support','korisnik','user','null','undefined') then
    base_username := 'user_' || left(replace(new.id::text, '-', ''), 8);
  end if;

  candidate_username := base_username;
  loop
    begin
      insert into public.profiles (id, username)
      values (new.id, candidate_username)
      on conflict (id) do nothing;
      return new;
    exception when unique_violation then
      attempt := attempt + 1;
      if attempt = 1 then
        candidate_username := left('user_' || replace(new.id::text, '-', ''), 30);
      else
        candidate_username := left('user_' || left(replace(new.id::text, '-', ''), 20) || '_' || attempt::text, 30);
      end if;
      if attempt >= 6 then
        raise exception 'Unable to allocate a unique profile username for Auth user %', new.id
          using errcode = '23505';
      end if;
    end;
  end loop;
end;
$function$;

revoke all on function public.handle_new_auth_user_profile() from public, anon, authenticated;

do $constraint$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_username_format'
  ) then
    alter table public.profiles
      add constraint profiles_username_format
      check (
        username ~ '^[[:alnum:]_.-]{3,30}$'
        and lower(username) not in ('admin','moderator','medjasi','liga','support','korisnik','user','null','undefined')
      ) not valid;
  end if;
end;
$constraint$;

commit;
