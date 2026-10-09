-- Fan Game admin grant RPC wrapper.
-- Apply to an existing database after sql/01_fan_game.sql has been installed.
-- The public wrapper runs as invoker; the underlying private function performs
-- its own server-side fan_is_admin() check and validates amount/reason.
begin;

do $$
begin
  if to_regprocedure('private.fan_admin_grant(uuid,integer,text)') is null then
    raise exception 'private.fan_admin_grant is missing; run sql/01_fan_game.sql and sql/02_security_hardening.sql first.';
  end if;
end $$;

grant usage on schema private to authenticated;

create or replace function public.fan_admin_grant(p_user uuid, p_amount integer, p_reason text)
returns integer language sql security invoker set search_path to public, pg_temp
as $$ select private.fan_admin_grant(p_user, p_amount, p_reason); $$;

revoke all on function public.fan_admin_grant(uuid, integer, text) from public, anon;
grant execute on function private.fan_admin_grant(uuid, integer, text) to authenticated;
grant execute on function public.fan_admin_grant(uuid, integer, text) to authenticated;

commit;
