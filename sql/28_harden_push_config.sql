-- Protect the VAPID private key stored in public.push_config.
-- The Edge Function accesses this table with the service-role client; browser
-- clients must never read the private key. This migration is safe to re-run.
begin;

do $$
begin
  if to_regclass('public.push_config') is null then
    raise exception 'Expected table public.push_config was not found; verify the deployed schema before applying this migration.';
  end if;
end;
$$;

alter table public.push_config enable row level security;
revoke all privileges on table public.push_config from public, anon, authenticated;

comment on table public.push_config is
  'Server-only push configuration. VAPID private key must not be exposed to browser roles; access is restricted to trusted server-side service-role operations.';

commit;

-- Verify after applying:
-- select c.relname, c.relrowsecurity
-- from pg_class c join pg_namespace n on n.oid = c.relnamespace
-- where n.nspname = 'public' and c.relname = 'push_config';
--
-- Check no browser role has table privileges:
-- select grantee, privilege_type
-- from information_schema.role_table_grants
-- where table_schema = 'public' and table_name = 'push_config'
--   and grantee in ('anon', 'authenticated', 'PUBLIC');
