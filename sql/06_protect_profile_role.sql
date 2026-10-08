-- Security hardening: profile roles are server-controlled.
-- Ordinary clients may create their own profile with only id/username and may
-- update username/avatar_url/bio, but cannot write the authorization role.

begin;

revoke insert, update on table public.profiles from authenticated;
revoke insert, update on table public.profiles from anon;

grant insert (id, username) on table public.profiles to authenticated;
grant update (username, avatar_url, bio) on table public.profiles to authenticated;

commit;
