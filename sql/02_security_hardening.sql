-- Upgrade/repair hardening for Fan Game RPCs.
-- Canonical fresh-install deployment is now included at the end of sql/01_fan_game.sql.
-- Moves SECURITY DEFINER implementations out of public and exposes only
-- SECURITY INVOKER wrappers through the public API.
-- This file remains as an idempotent upgrade for databases created before
-- the canonical install script was consolidated.
-- Supabase Auth leaked-password protection is intentionally not handled here;
-- that setting belongs to Authentication/Password Security in the dashboard.

begin;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- Move the original implementations only on first application.
-- When run again, public names are invoker wrappers and private implementations
-- already exist; do not move wrappers over those implementations.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname in (
        'fan_admin_grant','fan_buy_item','fan_claim_daily','fan_ensure_wallet',
        'fan_equip_item','fan_generate_markets','fan_leaderboard',
        'fan_market_event_reprice','fan_market_stats','fan_mvp_results',
        'fan_mvp_vote','fan_place_pick','fan_public_cosmetics',
        'fan_reprice_match','fan_reprice_match_event','fan_reprice_match_odds',
        'fan_set_odds','fan_settle_match','fan_team_donate'
      )
      and not exists (
        select 1
        from pg_proc private_p
        join pg_namespace private_n on private_n.oid=private_p.pronamespace
        where private_n.nspname='private'
          and private_p.proname=p.proname
          and private_p.proargtypes=p.proargtypes
      )
  loop
    execute format('alter function %s set schema private', r.signature);
  end loop;
end $$;

alter function public.fan_is_admin() security invoker;
alter function public.fan_is_admin() set search_path to public, pg_temp;

do $$
declare r record; def text;
begin
  for r in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='private'
      and p.proname in ('fan_generate_markets','fan_market_event_reprice','fan_reprice_match_event')
  loop
    def := pg_get_functiondef(r.oid);
    def := replace(def, 'public.fan_reprice_match(', 'private.fan_reprice_match(');
    def := replace(def, 'public.fan_reprice_match_odds(', 'private.fan_reprice_match_odds(');
    execute def;
  end loop;
end $$;

alter function private.fan_admin_grant(uuid, integer, text) set search_path to private, public, pg_temp;
alter function private.fan_buy_item(integer) set search_path to private, public, pg_temp;
alter function private.fan_claim_daily() set search_path to private, public, pg_temp;
alter function private.fan_ensure_wallet() set search_path to private, public, pg_temp;
alter function private.fan_equip_item(integer, boolean) set search_path to private, public, pg_temp;
alter function private.fan_generate_markets(text) set search_path to private, public, pg_temp;
alter function private.fan_leaderboard() set search_path to private, public, pg_temp;
alter function private.fan_market_event_reprice() set search_path to private, public, pg_temp;
alter function private.fan_market_stats(text) set search_path to private, public, pg_temp;
alter function private.fan_mvp_results(text) set search_path to private, public, pg_temp;
alter function private.fan_mvp_vote(text, text, integer) set search_path to private, public, pg_temp;
alter function private.fan_place_pick(uuid, integer, boolean) set search_path to private, public, pg_temp;
alter function private.fan_public_cosmetics(uuid[]) set search_path to private, public, pg_temp;
alter function private.fan_reprice_match(text) set search_path to private, public, pg_temp;
alter function private.fan_reprice_match_event() set search_path to private, public, pg_temp;
alter function private.fan_reprice_match_odds(text) set search_path to private, public, pg_temp;
alter function private.fan_set_odds(uuid, numeric) set search_path to private, public, pg_temp;
alter function private.fan_settle_match(text) set search_path to private, public, pg_temp;
alter function private.fan_team_donate(text, integer) set search_path to private, public, pg_temp;

revoke all on all functions in schema private from public, anon, authenticated;

create or replace function public.fan_admin_grant(p_user uuid, p_amount integer, p_reason text)
returns integer language sql security invoker set search_path to public, pg_temp
as $ select private.fan_admin_grant(p_user, p_amount, p_reason); $;

create or replace function public.fan_buy_item(p_item integer)
returns integer language sql security invoker set search_path to public, pg_temp
as $$ select private.fan_buy_item(p_item); $$;

create or replace function public.fan_claim_daily()
returns integer language sql security invoker set search_path to public, pg_temp
as $$ select private.fan_claim_daily(); $$;

create or replace function public.fan_ensure_wallet()
returns integer language sql security invoker set search_path to public, pg_temp
as $$ select private.fan_ensure_wallet(); $$;

create or replace function public.fan_equip_item(p_item integer, p_on boolean)
returns void language sql security invoker set search_path to public, pg_temp
as $$ select private.fan_equip_item(p_item, p_on); $$;

create or replace function public.fan_generate_markets(p_match text)
returns integer language sql security invoker set search_path to public, pg_temp
as $$ select private.fan_generate_markets(p_match); $$;

create or replace function public.fan_leaderboard()
returns table(user_id uuid, username text, balance integer, picks bigint, won bigint, title text, name_color text, frame text)
language sql stable security invoker set search_path to public, pg_temp
as $$ select * from private.fan_leaderboard(); $$;

create or replace function public.fan_market_stats(p_match text)
returns table(market_id uuid, picks bigint)
language sql stable security invoker set search_path to public, pg_temp
as $$ select * from private.fan_market_stats(p_match); $$;

create or replace function public.fan_mvp_results(p_match text)
returns table(player_id text, votes bigint)
language sql stable security invoker set search_path to public, pg_temp
as $$ select * from private.fan_mvp_results(p_match); $$;

create or replace function public.fan_mvp_vote(p_match text, p_player text, p_extra integer default 0)
returns jsonb language sql security invoker set search_path to public, pg_temp
as $$ select private.fan_mvp_vote(p_match, p_player, p_extra); $$;

create or replace function public.fan_place_pick(p_market uuid, p_stake integer, p_boost boolean default false)
returns jsonb language sql security invoker set search_path to public, pg_temp
as $$ select private.fan_place_pick(p_market, p_stake, p_boost); $$;

create or replace function public.fan_public_cosmetics(p_users uuid[])
returns table(user_id uuid, name_color text, frame text, badge text, title text, emoji_pack text)
language sql stable security invoker set search_path to public, pg_temp
as $$ select * from private.fan_public_cosmetics(p_users); $$;

create or replace function public.fan_settle_match(p_match text)
returns jsonb language sql security invoker set search_path to public, pg_temp
as $$ select private.fan_settle_match(p_match); $$;

create or replace function public.fan_team_donate(p_team text, p_amount integer)
returns integer language sql security invoker set search_path to public, pg_temp
as $$ select private.fan_team_donate(p_team, p_amount); $$;

revoke all on function public.fan_admin_grant(uuid, integer, text) from public, anon;
revoke all on function public.fan_buy_item(integer) from public, anon;
revoke all on function public.fan_claim_daily() from public, anon;
revoke all on function public.fan_ensure_wallet() from public, anon;
revoke all on function public.fan_equip_item(integer, boolean) from public, anon;
revoke all on function public.fan_generate_markets(text) from public, anon;
revoke all on function public.fan_leaderboard() from public, anon;
revoke all on function public.fan_market_stats(text) from public, anon;
revoke all on function public.fan_mvp_results(text) from public, anon;
revoke all on function public.fan_mvp_vote(text, text, integer) from public, anon;
revoke all on function public.fan_place_pick(uuid, integer, boolean) from public, anon;
revoke all on function public.fan_public_cosmetics(uuid[]) from public, anon;
revoke all on function public.fan_settle_match(text) from public, anon;
revoke all on function public.fan_team_donate(text, integer) from public, anon;

grant execute on function public.fan_admin_grant(uuid, integer, text) to authenticated;
grant execute on function public.fan_buy_item(integer) to authenticated;
grant execute on function public.fan_claim_daily() to authenticated;
grant execute on function public.fan_ensure_wallet() to authenticated;
grant execute on function public.fan_equip_item(integer, boolean) to authenticated;
grant execute on function public.fan_generate_markets(text) to authenticated;
grant execute on function public.fan_leaderboard() to authenticated;
grant execute on function public.fan_market_stats(text) to authenticated;
grant execute on function public.fan_mvp_results(text) to authenticated;
grant execute on function public.fan_mvp_vote(text, text, integer) to authenticated;
grant execute on function public.fan_place_pick(uuid, integer, boolean) to authenticated;
grant execute on function public.fan_public_cosmetics(uuid[]) to authenticated;
grant execute on function public.fan_settle_match(text) to authenticated;
grant execute on function public.fan_team_donate(text, integer) to authenticated;

grant execute on function private.fan_admin_grant(uuid, integer, text) to authenticated;
grant execute on function private.fan_buy_item(integer) to authenticated;
grant execute on function private.fan_claim_daily() to authenticated;
grant execute on function private.fan_ensure_wallet() to authenticated;
grant execute on function private.fan_equip_item(integer, boolean) to authenticated;
grant execute on function private.fan_generate_markets(text) to authenticated;
grant execute on function private.fan_leaderboard() to authenticated;
grant execute on function private.fan_market_stats(text) to authenticated;
grant execute on function private.fan_mvp_results(text) to authenticated;
grant execute on function private.fan_mvp_vote(text, text, integer) to authenticated;
grant execute on function private.fan_place_pick(uuid, integer, boolean) to authenticated;
grant execute on function private.fan_public_cosmetics(uuid[]) to authenticated;
grant execute on function private.fan_settle_match(text) to authenticated;
grant execute on function private.fan_team_donate(text, integer) to authenticated;

comment on schema private is 'Internal SECURITY DEFINER functions; not exposed through the Supabase Data API.';

commit;
