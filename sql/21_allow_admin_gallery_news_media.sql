-- Restore the intended administrator-only upload/delete paths for league media.
-- Migration 16 deliberately confines ordinary authenticated users to their own
-- image folders. The admin gallery and news UI, however, uploads to
-- gallery/<uuid>.<ext> and news/<uuid>.<ext>; those paths need a separate policy.
begin;

do $preflight$
begin
  if not exists (
    select 1 from storage.buckets where id = 'liga-images'
  ) then
    raise exception 'Storage bucket liga-images is missing; refusing to add admin media policies.';
  end if;

  if to_regprocedure('public.fan_is_admin()') is null then
    raise exception 'public.fan_is_admin() is missing; apply the Fan Game/security migrations first.';
  end if;
end;
$preflight$;

drop policy if exists liga_images_admin_media_insert on storage.objects;
create policy liga_images_admin_media_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'liga-images'
  and (select public.fan_is_admin())
  -- Match the exact one-level paths produced by uploadFile() and randomUUID().
  and name ~ '^(gallery|news)/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp|gif|avif|mp4|webm|ogv)$'
  and (
    (lower(coalesce(metadata->>'mimetype','')) = 'image/jpeg' and name ~ '\.jpg$')
    or (lower(coalesce(metadata->>'mimetype','')) = 'image/png' and name ~ '\.png$')
    or (lower(coalesce(metadata->>'mimetype','')) = 'image/webp' and name ~ '\.webp$')
    or (lower(coalesce(metadata->>'mimetype','')) = 'image/gif' and name ~ '\.gif$')
    or (lower(coalesce(metadata->>'mimetype','')) = 'image/avif' and name ~ '\.avif$')
    or (lower(coalesce(metadata->>'mimetype','')) = 'video/mp4' and name ~ '\.mp4$')
    or (lower(coalesce(metadata->>'mimetype','')) = 'video/webm' and name ~ '\.webm$')
    or (lower(coalesce(metadata->>'mimetype','')) = 'video/ogg' and name ~ '\.ogv$')
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

drop policy if exists liga_images_admin_media_delete on storage.objects;
create policy liga_images_admin_media_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'liga-images'
  and (select public.fan_is_admin())
  -- Allow admins to clean up legacy media filenames as well as newly generated UUID names.
  and (name like 'gallery/%' or name like 'news/%')
);

commit;
