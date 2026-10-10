-- Remove direct SELECT privileges from anon on tables whose RLS policies
-- intentionally allow reads only to authenticated users. RLS already blocks
-- anonymous rows; removing unused table privileges makes the ACL match policy intent.
-- This is deliberately limited to these tables and does not change public read APIs.
begin;

do $revoke_unneeded_anon_select$
declare
  table_name text;
begin
  foreach table_name in array array[
    'admin_audit_log',
    'community_poll_votes',
    'fan_favorites',
    'fan_inventory',
    'fan_mvp_votes',
    'fan_picks',
    'fan_team_follows'
  ]
  loop
    if to_regclass(format('%I.%I','public',table_name)) is not null then
      execute format('revoke select on table public.%I from anon',table_name);
    end if;
  end loop;
end;
$revoke_unneeded_anon_select$;

commit;
