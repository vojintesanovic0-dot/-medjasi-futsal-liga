-- Remove the superseded profile-role trigger.
-- The newer trg_protect_profile_role trigger already protects INSERT/UPDATE:
-- it blocks authenticated self-escalation and moderators' unauthorized role edits,
-- while deliberately allowing trusted SQL Editor/server contexts where auth.uid()
-- is null. The older trigger does not distinguish that trusted context and causes
-- conflicting behavior; live catalog inspection confirmed it is its function's
-- only dependency.
begin;

drop trigger if exists profiles_prevent_role_escalation on public.profiles;
drop function if exists public.prevent_profile_role_escalation();

commit;
