-- Keep Auth signup resilient when a requested username is already taken.
-- This only replaces the trigger function; existing profiles and roles are untouched.
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
    regexp_replace(
      coalesce(
        new.raw_user_meta_data ->> 'username',
        split_part(coalesce(new.email, ''), '@', 1)
      ),
      '[^[:alnum:]_.-]',
      '',
      'g'
    ),
    30
  );

  if coalesce(base_username, '') = '' then
    base_username := 'user_' || left(replace(new.id::text, '-', ''), 8);
  end if;

  candidate_username := base_username;

  loop
    begin
      -- A duplicate user id is already handled; a username collision retries below.
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

commit;
