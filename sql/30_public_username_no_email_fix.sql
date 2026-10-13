-- 30B: POPRAVKA — pokreni tek nakon pregleda sql/30_public_username_no_email.sql.
-- Mijenja trigger funkciju i samo zapise čije je javno ime jednako lokalnom dijelu emaila,
-- kada korisnik nema username u raw_user_meta_data. Ne dira role, lozinke ni ostale podatke.
-- Prije pokretanja napravi backup baze.

-- Pokreni ovu datoteku tek nakon pregleda rezultata iz sql/30_public_username_no_email.sql.
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

-- Nakon B, ponovo pokreni A. Očekivani rezultat za ova tri upita: 0 redova.
-- Ako se javi greška zbog drugačije šeme kolona, provjeri information_schema.columns
-- i prilagodi nazive; ova migracija ne briše objave, komentare niti vijesti.
