-- =====================================================================
-- 00 REFERENCE: RLS politike za osnovne tabele aplikacije.
--
-- Ova skripta NE kreira i NE mijenja osnovne tabele. Za svaku ciljanu
-- tabelu koja POSTOJI, a NEMA nijednu RLS politiku, uključiće RLS i dodaće
-- minimalne politike. Tabele sa postojećim politikama se ne diraju.
-- =====================================================================

begin;

create or replace function public.medjasi_is_admin()
returns boolean
language sql stable security invoker set search_path = public, pg_temp
as $$ select exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin'); $$;

grant execute on function public.medjasi_is_admin() to anon, authenticated;

do $$
declare
  t text;
  pub_admin_write text[] := array['teams','players','matches','goals','cards','match_players',
                                  'news','gallery','music_tracks','site_settings','league_events'];
begin
  foreach t in array pub_admin_write loop
    if to_regclass('public.'||t) is not null
       and not exists (select 1 from pg_policies where schemaname='public' and tablename=t) then
      execute format('alter table public.%I enable row level security', t);
      execute format('create policy %I on public.%I for select to anon, authenticated using (true)', t||'_read', t);
      execute format('create policy %I on public.%I for insert to authenticated with check ((select public.medjasi_is_admin()))', t||'_admin_ins', t);
      execute format('create policy %I on public.%I for update to authenticated using ((select public.medjasi_is_admin())) with check ((select public.medjasi_is_admin()))', t||'_admin_upd', t);
      execute format('create policy %I on public.%I for delete to authenticated using ((select public.medjasi_is_admin()))', t||'_admin_del', t);
    end if;
  end loop;

  foreach t in array array['comments','messages'] loop
    if to_regclass('public.'||t) is not null
       and not exists (select 1 from pg_policies where schemaname='public' and tablename=t) then
      execute format('alter table public.%I enable row level security', t);
      execute format('create policy %I on public.%I for select to anon, authenticated using (true)', t||'_read', t);
      execute format('create policy %I on public.%I for insert to authenticated with check (user_id = (select auth.uid()))', t||'_ins_own', t);
      execute format('create policy %I on public.%I for delete to authenticated using (user_id = (select auth.uid()) or (select public.medjasi_is_admin()))', t||'_del_own', t);
      execute format('create policy %I on public.%I for update to authenticated using ((select public.medjasi_is_admin())) with check ((select public.medjasi_is_admin()))', t||'_admin_upd', t);
    end if;
  end loop;

  if to_regclass('public.push_subscriptions') is not null
     and not exists (select 1 from pg_policies where schemaname='public' and tablename='push_subscriptions') then
    alter table public.push_subscriptions enable row level security;
    create policy push_subs_own on public.push_subscriptions for all to authenticated
      using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
  end if;

  if to_regclass('public.profiles') is not null
     and not exists (select 1 from pg_policies where schemaname='public' and tablename='profiles') then
    alter table public.profiles enable row level security;
    create policy profiles_read on public.profiles for select to anon, authenticated using (true);
    create policy profiles_ins_own on public.profiles for insert to authenticated with check (id = (select auth.uid()));
    create policy profiles_upd_own on public.profiles for update to authenticated
      using (id = (select auth.uid())) with check (id = (select auth.uid()));
  end if;
end $$;

commit;
