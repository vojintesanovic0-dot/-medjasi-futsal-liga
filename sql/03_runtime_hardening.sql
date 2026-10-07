-- Runtime hardening for Supabase Realtime and Fan Game event flow.
-- Safe/idempotent: adds required realtime tables and removes legacy
-- duplicate Fan Game repricing triggers. Canonical trg_fan_reprice_* remain.

begin;
alter publication supabase_realtime add table public.matches;
alter publication supabase_realtime add table public.goals;
alter publication supabase_realtime add table public.cards;
alter publication supabase_realtime add table public.comments;
alter publication supabase_realtime add table public.news;
drop trigger if exists fan_reprice_on_match on public.matches;
drop trigger if exists fan_reprice_on_goal on public.goals;
drop trigger if exists fan_reprice_on_card on public.cards;
commit;
