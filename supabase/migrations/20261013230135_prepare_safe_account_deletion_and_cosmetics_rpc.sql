-- Account deletion integrity and public cosmetics RPC privilege hardening.
-- Applied to the linked production project on 2026-10-14; this file records the change.
begin;

alter table public.community_reports
  drop constraint if exists community_reports_reviewed_by_fkey;
alter table public.community_reports
  add constraint community_reports_reviewed_by_fkey
  foreign key (reviewed_by) references auth.users(id) on delete set null;

alter table public.gallery_albums
  drop constraint if exists gallery_albums_created_by_fkey;
alter table public.gallery_albums
  add constraint gallery_albums_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;

create or replace function public.fan_public_cosmetics(p_users uuid[])
returns table(user_id uuid, name_color text, frame text, badge text, title text, emoji_pack text)
language sql
stable
security invoker
set search_path = private, public, pg_temp
as $function$
  select * from private.fan_public_cosmetics(p_users);
$function$;

revoke all on function public.fan_public_cosmetics(uuid[]) from public, anon;
grant execute on function public.fan_public_cosmetics(uuid[]) to authenticated;

commit;
