-- Allow the public UI to read only the deliberately public fan cosmetics projection.
-- The SECURITY DEFINER wrapper exposes six cosmetic fields only; the underlying
-- private function remains outside the PostgREST-exposed public schema.
begin;

do $preflight$
begin
  if to_regprocedure('private.fan_public_cosmetics(uuid[])') is null then
    raise exception 'Expected private.fan_public_cosmetics(uuid[]) was not found; refusing to change RPC access.';
  end if;
end;
$preflight$;

create or replace function public.fan_public_cosmetics(p_users uuid[])
returns table(
  user_id uuid,
  name_color text,
  frame text,
  badge text,
  title text,
  emoji_pack text
)
language sql
stable
security definer
set search_path = 'private', 'public', 'pg_temp'
as $function$
  select * from private.fan_public_cosmetics(p_users);
$function$;

revoke all on function public.fan_public_cosmetics(uuid[]) from public;
grant execute on function public.fan_public_cosmetics(uuid[]) to anon, authenticated;

commit;
