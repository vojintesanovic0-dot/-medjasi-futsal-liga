-- Minimize Data API privileges on sensitive tables.
-- RLS policies remain the primary row-level control; these grants reduce
-- the operations available to public roles in the first place.

begin;

revoke all on table public.fan_wallets from anon;
revoke all on table public.fan_ledger from anon;
revoke all on table public.push_subscriptions from anon;
revoke all on table public.team_applications from anon;
revoke all on table public.community_reports from anon;
revoke all on table public.community_blocks from anon;

revoke insert, update, delete on table public.fan_wallets from authenticated;
revoke insert, update, delete on table public.fan_ledger from authenticated;
grant select on table public.fan_wallets to authenticated;
grant select on table public.fan_ledger to authenticated;

revoke delete on table public.team_applications from authenticated;
grant select, insert, update on table public.team_applications to authenticated;

revoke references, trigger, truncate on table public.fan_wallets, public.fan_ledger, public.push_subscriptions, public.team_applications, public.community_reports, public.community_blocks from authenticated;

commit;
