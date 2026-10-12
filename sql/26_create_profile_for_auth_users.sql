-- Ensure every new Auth account receives a normal user profile even when
-- email confirmation is required and the browser has no active session yet.
-- Backfill is limited to Auth users that do not already have a profile.
begin;

create or replace function public.handle_new_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  requested_username text;
begin
  requested_username := left(
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

  if coalesce(requested_username, '') = '' then
    requested_username := 'user_' || left(replace(new.id::text, '-', ''), 8);
  end if;

  -- Never copy a role from user metadata; the table default assigns 'user'.
  insert into public.profiles (id, username)
  values (new.id, requested_username)
  on conflict (id) do nothing;

  return new;
end;
$function$;

revoke all on function public.handle_new_auth_user_profile() from public, anon, authenticated;

drop trigger if exists on_auth_user_created_create_profile on auth.users;
create trigger on_auth_user_created_create_profile
  after insert on auth.users
  for each row execute function public.handle_new_auth_user_profile();

-- Repair only missing profiles; preserve every existing profile and role.
insert into public.profiles (id, username)
select
  u.id,
  coalesce(
    nullif(
      left(
        regexp_replace(
          coalesce(
            u.raw_user_meta_data ->> 'username',
            split_part(coalesce(u.email, ''), '@', 1)
          ),
          '[^[:alnum:]_.-]',
          '',
          'g'
        ),
        30
      ),
      ''
    ),
    'user_' || left(replace(u.id::text, '-', ''), 8)
  )
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;

commit;
