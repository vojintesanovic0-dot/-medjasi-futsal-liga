-- Remove authenticated table DML grants where no RLS policy allows that command,
-- and restrict public sequence access. RLS policy-authorized actions are retained.
begin;

do $revoke_unpolicied_dml$
declare
  item record;
begin
  for item in
    select t.schemaname, t.tablename, c.cmd
    from pg_tables t
    cross join (values ('INSERT'), ('UPDATE'), ('DELETE')) as c(cmd)
    where t.schemaname = 'public'
      and has_table_privilege(
        'authenticated',
        format('%I.%I', t.schemaname, t.tablename),
        c.cmd
      )
      and not exists (
        select 1
        from pg_policies p
        where p.schemaname = t.schemaname
          and p.tablename = t.tablename
          and p.cmd in (c.cmd, 'ALL')
          and (
            p.roles @> array['authenticated']::name[]
            or p.roles @> array['public']::name[]
          )
      )
  loop
    execute format(
      'REVOKE %s ON TABLE %I.%I FROM authenticated',
      item.cmd,
      item.schemaname,
      item.tablename
    );
  end loop;
end;
$revoke_unpolicied_dml$;

-- Anonymous users have read-only access to public data; they must not be able
-- to advance or inspect internal sequence values.
revoke all on all sequences in schema public from anon;

-- Only the three serial sequences used by policy-authorized direct INSERT
-- paths retain USAGE for authenticated API requests.
revoke all on all sequences in schema public from authenticated;
grant usage on sequence
  public.fan_shop_items_id_seq,
  public.sponsors_id_seq,
  public.team_applications_id_seq
to authenticated;

-- New tables created by the postgres migration role start read-only for
-- authenticated users; migration authors must explicitly grant actions backed
-- by RLS policies.
alter default privileges for role postgres in schema public
  revoke insert, update, delete on tables from authenticated;

alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;

commit;
