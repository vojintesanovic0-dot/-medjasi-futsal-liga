-- Secure future PostgreSQL functions by default.
-- Existing function privileges are untouched; API functions must explicitly GRANT
-- EXECUTE to the roles that need them in the migration that creates the function.
begin;

-- PostgreSQL grants EXECUTE to PUBLIC on new functions unless this global default
-- is changed. This revokes only the future-object default for functions created
-- by postgres; current RPCs and trigger functions retain their current ACLs.
alter default privileges for role postgres
  revoke execute on functions from public;

-- Supabase-specific per-schema default grants to client roles must also be
-- removed; per-schema REVOKE only undoes corresponding schema-level grants.
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;

commit;
