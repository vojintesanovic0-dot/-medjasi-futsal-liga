-- Restore the table-level privileges required by the News editor.
-- Earlier hardening migrations may revoke DML grants when no matching RLS
-- policy existed at that point in migration order. Adding an RLS policy later
-- does not restore PostgreSQL table privileges by itself.
--
-- These grants do NOT bypass RLS: the existing news policies continue to
-- restrict writes to administrators/content editors and public reads to
-- published articles.
begin;

do $preflight$
begin
  if to_regclass('public.news') is null then
    raise exception 'Expected public.news table was not found; refusing to grant News permissions.';
  end if;
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'news'
      and cmd = 'INSERT'
      and (
        roles @> array['authenticated']::name[]
        or roles @> array['public']::name[]
      )
  ) then
    raise exception 'No authenticated INSERT RLS policy exists on public.news; refusing to enable client writes.';
  end if;
end;
$preflight$;

grant select, insert, update, delete on table public.news to authenticated;

commit;
