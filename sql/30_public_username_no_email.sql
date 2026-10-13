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

-- OVA DATOTEKA JE SAMO ZA PREGLED. Ne sadrži UPDATE ni CREATE FUNCTION.
-- Nakon pregleda rezultata, pokreni odvojeno sql/30_public_username_no_email_fix.sql.
