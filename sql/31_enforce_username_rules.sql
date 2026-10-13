-- 31: Enforce username format and reserved-name rules in PostgreSQL.
-- Existing invalid rows are not scanned immediately (NOT VALID); new/changed rows
-- must satisfy the rule. Review/fix legacy rows before VALIDATE CONSTRAINT.

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
  -- Do not silently rewrite a requested name. Invalid metadata gets a safe
  -- temporary username; the user can choose a valid public name after signup.
  base_username := coalesce(new.raw_user_meta_data ->> 'username', '');

  if base_username !~ '^[A-Za-z0-9_.-]{3,30}$'
     or lower(base_username) = any (array[
       'admin','moderator','medjasi','liga','support','korisnik','user','null','undefined'
     ]) then
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
        candidate_username := left(
          'user_' || left(replace(new.id::text, '-', ''), 20) || '_' || attempt::text,
          30
        );
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

do $migration$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_username_format'
  ) then
    alter table public.profiles
      add constraint profiles_username_format
      check (
        username is not null
        and username ~ '^[A-Za-z0-9_.-]{3,30}$'
        and lower(username) <> all (array[
          'admin','moderator','medjasi','liga','support','korisnik','user','null','undefined'
        ])
      ) not valid;
  end if;
end;
$migration$;

commit;

-- Read-only legacy audit; run before deciding how to rename existing accounts:
-- select id, username from public.profiles
-- where username is null
--    or username !~ '^[A-Za-z0-9_.-]{3,30}$'
--    or lower(username) = any (array[
--      'admin','moderator','medjasi','liga','support','korisnik','user','null','undefined'
--    ]);
--
-- After legacy rows are corrected:
-- alter table public.profiles validate constraint profiles_username_format;
