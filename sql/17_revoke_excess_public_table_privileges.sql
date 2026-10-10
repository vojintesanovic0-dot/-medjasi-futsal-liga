-- Reduce exposed-schema table privileges independently of RLS.
-- Public reads remain as currently configured. Authenticated INSERT/UPDATE/DELETE
-- grants remain available where RLS policies already govern those operations.
-- Non-client maintenance/DDL-related privileges are not needed by the browser app.
begin;

do $revoke_excess_privileges$
declare
  relation record;
begin
  for relation in
    select schemaname, tablename
    from pg_tables
    where schemaname = 'public'
  loop
    execute format(
      'revoke insert, update, delete, truncate, references, trigger, maintain on table %I.%I from anon',
      relation.schemaname,
      relation.tablename
    );

    execute format(
      'revoke truncate, references, trigger, maintain on table %I.%I from authenticated',
      relation.schemaname,
      relation.tablename
    );
  end loop;
end;
$revoke_excess_privileges$;

-- New app tables created by the postgres migration role must not inherit write
-- privileges for anonymous visitors, or maintenance privileges for client roles.
alter default privileges for role postgres in schema public
  revoke insert, update, delete, truncate, references, trigger, maintain on tables from anon;

alter default privileges for role postgres in schema public
  revoke truncate, references, trigger, maintain on tables from authenticated;

commit;
