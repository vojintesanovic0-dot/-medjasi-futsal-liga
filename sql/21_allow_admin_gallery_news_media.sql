-- Tighten the legacy broad admin Storage policies without breaking the app's
-- actual upload roots: teams/, players/, gallery/, and news/.
-- Migration 16 restricts ordinary user uploads to their own image folders.
-- The admin UI uses gallery/<uuid>.<ext>, news/<uuid>.<ext>, teams/<uuid>.<ext>,
-- players/<uuid>.<ext>, and players/<player-id>/<uuid>.<ext>.
begin;

do $preflight$
begin
  if not exists (
    select 1 from storage.buckets where id = 'liga-images'
  ) then
    raise exception 'Storage bucket liga-images is missing; refusing to update admin media policies.';
  end if;

  if to_regprocedure('public.fan_is_admin()') is null then
    raise exception 'public.fan_is_admin() is missing; apply the Fan Game/security migrations first.';
  end if;
end;
$preflight$;

-- Remove older policies that authorized any path/type for admins. Storage RLS
-- combines permissive policies with OR, so leaving them in place would make the
-- more specific policy below ineffective.
drop policy if exists liga_images_admin_insert on storage.objects;
drop policy if exists liga_images_admin_update on storage.objects;
drop policy if exists liga_images_admin_delete on storage.objects;
drop policy if exists liga_images_admin_media_insert on storage.objects;
drop policy if exists liga_images_admin_media_update on storage.objects;
drop policy if exists liga_images_admin_media_delete on storage.objects;

create policy liga_images_admin_media_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'liga-images'
  and (select public.fan_is_admin())
  -- Current file names are UUIDv4, with a single nested player-ID folder only
  -- when editing an existing player profile.
  and (
    name ~ '^(gallery|news|teams|players)/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp|gif|avif)$'
    or name ~ '^(gallery|news)/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(mp4|webm|ogv)$'
    or name ~ '^players/[A-Za-z0-9_-]+/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp|gif|avif)$'
  )
  and (
    (lower(coalesce(metadata->>'mimetype','')) = 'image/jpeg' and name ~ '\.jpg$')
    or (lower(coalesce(metadata->>'mimetype','')) = 'image/png' and name ~ '\.png$')
    or (lower(coalesce(metadata->>'mimetype','')) = 'image/webp' and name ~ '\.webp$')
    or (lower(coalesce(metadata->>'mimetype','')) = 'image/gif' and name ~ '\.gif$')
    or (lower(coalesce(metadata->>'mimetype','')) = 'image/avif' and name ~ '\.avif$')
    or (lower(coalesce(metadata->>'mimetype','')) = 'video/mp4' and name ~ '^((gallery|news)/)[0-9a-f-]+\.mp4$')
    or (lower(coalesce(metadata->>'mimetype','')) = 'video/webm' and name ~ '^((gallery|news)/)[0-9a-f-]+\.webm$')
    or (lower(coalesce(metadata->>'mimetype','')) = 'video/ogg' and name ~ '^((gallery|news)/)[0-9a-f-]+\.ogv$')
  )
  and case
    when coalesce(metadata->>'size','') ~ '^[0-9]+$' then
      case
        when lower(coalesce(metadata->>'mimetype','')) = any(array[
          'image/jpeg','image/png','image/webp','image/gif','image/avif'
        ]::text[]) then (metadata->>'size')::bigint <= 15728640
        when lower(coalesce(metadata->>'mimetype','')) = any(array[
          'video/mp4','video/webm','video/ogg'
        ]::text[]) then (metadata->>'size')::bigint <= 52428800
        else false
      end
    else false
  end
);

-- Preserve the app's potential in-place edit path while limiting updates to
-- the same admin-owned media directories. Normal uploads use upsert:false.
create policy liga_images_admin_media_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'liga-images'
  and (select public.fan_is_admin())
  and (name like 'gallery/%' or name like 'news/%' or name like 'teams/%' or name like 'players/%')
)
with check (
  bucket_id = 'liga-images'
  and (select public.fan_is_admin())
  and (name like 'gallery/%' or name like 'news/%' or name like 'teams/%' or name like 'players/%')
);

create policy liga_images_admin_media_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'liga-images'
  and (select public.fan_is_admin())
  -- Keep cleanup compatible with legacy filenames in admin-managed folders.
  and (name like 'gallery/%' or name like 'news/%' or name like 'teams/%' or name like 'players/%')
);

commit;
