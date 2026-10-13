-- 30: Javno korisničko ime ne smije se automatski izvoditi iz email adrese.
-- PAŽNJA: prvo pokreni samo upite u dijelu A i pregledaj rezultate.
-- Dio B mijenja trigger funkciju i postojeće javne zapise; pokreni ga tek nakon pregleda.
-- Ova datoteka ne izvršava se automatski na Supabase-u.

-- =====================================================================
-- A) PREGLED — samo čitanje
-- =====================================================================
select p.id, p.username, u.email
from public.profiles p
join auth.users u on u.id = p.id
where (u.raw_user_meta_data ->> 'username') is null
  and p.username = split_part(coalesce(u.email, ''), '@', 1);

select m.id, m.username, m.created_at
from public.messages m
join auth.users u on u.id::text = m.user_id::text
where (u.raw_user_meta_data ->> 'username') is null
  and m.username = split_part(coalesce(u.email, ''), '@', 1);

select n.id, n.author_name, n.created_at
from public.news n
join auth.users u on u.id::text = n.author_id::text
where (u.raw_user_meta_data ->> 'username') is null
  and n.author_name = split_part(coalesce(u.email, ''), '@', 1);

-- Pregled je samo za čitanje. Ako rezultati zahtijevaju korekciju,
-- otvori odvojenu datoteku sql/30_public_username_no_email_fix.sql i pokreni je tek nakon provjere.


-- =====================================================================
-- B) POPRAVKA — POKRENI ODVOJENO TEK NAKON PREGLEDA DIJELA A
-- Ovaj blok mijenja trigger funkciju i postojeće zapise. Nije automatski izvršen.
-- =====================================================================
begin;

create or replace function public.handle_new_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  base_username text;
  candidate_username text;
  attempt integer := 0;
begin
  base_username := left(
    regexp_replace(coalesce(new.raw_user_meta_data ->> 'username', ''), '[^[:alnum:]_.-]', '', 'g'),
    30
  );

  if coalesce(base_username, '') = '' then
    base_username := 'user_' || left(replace(new.id::text, '-', ''), 8);
  end if;

  candidate_username := base_username;

  loop
    begin
      insert into public.profiles (id, username)
      values (new.id, candidate_username)
      on conflict (id) do nothing;

      return new;
    exception when unique_violation then
      attempt := attempt + 1;

      if attempt = 1 then
        candidate_username := left('user_' || replace(new.id::text, '-', ''), 30);
      else
        candidate_username := left(
          'user_' || left(replace(new.id::text, '-', ''), 20) || '_' || attempt::text,
          30
        );
      end if;

      if attempt >= 6 then
        raise exception 'Unable to allocate a unique profile username for Auth user %', new.id
          using errcode = '23505';
      end if;
    end;
  end loop;
end;
$function$;

revoke all on function public.handle_new_auth_user_profile() from public, anon, authenticated;

update public.profiles p
set username = 'user_' || left(replace(p.id::text, '-', ''), 8)
from auth.users u
where u.id = p.id
  and (u.raw_user_meta_data ->> 'username') is null
  and p.username = split_part(coalesce(u.email, ''), '@', 1);

update public.messages m
set username = 'user_' || left(replace(m.user_id::text, '-', ''), 8)
from auth.users u
where u.id::text = m.user_id::text
  and (u.raw_user_meta_data ->> 'username') is null
  and m.username = split_part(coalesce(u.email, ''), '@', 1);

update public.news n
set author_name = 'user_' || left(replace(n.author_id::text, '-', ''), 8)
from auth.users u
where u.id::text = n.author_id::text
  and (u.raw_user_meta_data ->> 'username') is null
  and n.author_name = split_part(coalesce(u.email, ''), '@', 1);

commit;

-- Nakon B, ponovo pokreni tri upita iz dijela A; očekivano je 0 redova.
-- Ako neka tabela/kolona ne postoji, provjeri information_schema.columns i prilagodi.
