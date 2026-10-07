-- Runtime hardening for Supabase Realtime.
-- Idempotent: adds required tables to the realtime publication only when needed.
-- Existing Fan Game repricing triggers are intentionally preserved because the
-- current database uses trg_fan_reprice_* as active event handlers.

begin;

do $$
declare
  t text;
begin
  foreach t in array array[
    'matches','goals','cards','match_players',
    'comments','messages','gallery','news',
    'league_events','site_settings','music_tracks'
  ] loop
    if to_regclass('public.' || quote_ident(t)) is not null
       and not exists (
         select 1
         from pg_publication_tables
         where pubname='supabase_realtime'
           and schemaname='public'
           and tablename=t
       ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

commit;
