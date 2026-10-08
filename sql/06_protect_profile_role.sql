-- Security hardening: profile roles are server-controlled.
-- Ordinary clients must never be able to insert or update profiles.role.
-- Admin role changes remain available through the dedicated SECURITY DEFINER
-- admin_set_user_role() function.

begin;

revoke insert (role) on table public.profiles from anon, authenticated;
revoke update (role) on table public.profiles from anon, authenticated;

commit;
