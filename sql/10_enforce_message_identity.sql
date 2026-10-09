-- Prevent authenticated clients from impersonating another user in chat.
-- RLS still controls who may insert a message; this trigger canonicalizes the
-- displayed username from the profile tied to NEW.user_id.

begin;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.medjasi_enforce_message_identity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  canonical_username text;
begin
  select nullif(btrim(p.username), '')
    into canonical_username
  from public.profiles p
  where p.id = new.user_id;

  new.username := coalesce(canonical_username, 'Korisnik');
  return new;
end;
$function$;

drop trigger if exists trg_medjasi_enforce_message_identity on public.messages;
create trigger trg_medjasi_enforce_message_identity
before insert or update of user_id, username
on public.messages
for each row
execute function private.medjasi_enforce_message_identity();

revoke all on function private.medjasi_enforce_message_identity() from public, anon, authenticated;

commit;
