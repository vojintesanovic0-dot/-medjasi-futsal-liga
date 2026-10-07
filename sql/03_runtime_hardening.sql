-- Runtime hardening for Supabase Realtime and Fan Game event flow.
-- Idempotent migration: adds required realtime tables only when missing and
-- removes legacy duplicate Fan Game repricing triggers.

begin;

do $$
declare
  t text;
begin
  foreach t in array array['matches','goals','cards','comments','news'] loop
    if not exists (
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

drop trigger if exists fan_reprice_on_match on public.matches;
drop trigger if exists fan_reprice_on_goal on public.goals;
drop trigger if exists fan_reprice_on_card on public.cards;

commit;
