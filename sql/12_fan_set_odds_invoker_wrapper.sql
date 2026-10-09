-- Authenticated invoker wrapper for the Fan Game odds admin action.
-- The private SECURITY DEFINER function still checks fan_is_admin() and validates odds.
begin;

do $$
begin
  if to_regprocedure('private.fan_set_odds(uuid,numeric)') is null then
    raise exception 'private.fan_set_odds is missing; run sql/01_fan_game.sql and sql/02_security_hardening.sql first.';
  end if;
end $$;

grant usage on schema private to authenticated;
grant execute on function private.fan_set_odds(uuid, numeric) to authenticated;

create or replace function public.fan_set_odds(p_market uuid, p_odds numeric)
returns void
language sql
security invoker
set search_path to public, pg_temp
as $$ select private.fan_set_odds(p_market, p_odds); $$;

revoke all on function public.fan_set_odds(uuid, numeric) from public, anon;
grant execute on function public.fan_set_odds(uuid, numeric) to authenticated;

commit;
