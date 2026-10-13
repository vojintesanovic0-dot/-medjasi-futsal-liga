-- 31: Enforce public username rules for profile rows.
-- Run the read-only inspection queries first and repair legacy rows before VALIDATE.
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
    regexp_replace(coalesce(new.raw_user_meta_data ->> 'username', ''), '[^A-Za-z0-9_.-]', '', 'g'),
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

-- Read-only inspection: review and repair any returned legacy usernames.
select id, username
from public.profiles
where username !~ '^[A-Za-z0-9_.-]{3,30}$'
   or lower(username) in ('admin','moderator','medjasi','liga','support','korisnik','user','null','undefined');

select count(*) as prazna_imena
from public.profiles
where username is null or username = '';

-- NOT VALID preserves legacy rows but enforces all future inserts/updates.
alter table public.profiles
  add constraint profiles_username_format
  check (
    username ~ '^[A-Za-z0-9_.-]{3,30}$'
    and lower(username) not in ('admin','moderator','medjasi','liga','support','korisnik','user','null','undefined')
  ) not valid;

commit;

-- After repairing existing rows, run separately:
-- alter table public.profiles validate constraint profiles_username_format;
