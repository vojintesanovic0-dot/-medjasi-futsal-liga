-- Enforce the media limits at the Storage API boundary, not only in the browser.
-- Admins can upload supported video to gallery/news; ordinary accounts can upload
-- images only to their own profile/community/chat folders.
begin;

do $preflight$
begin
  if not exists (
    select 1 from storage.buckets where id = 'liga-images'
  ) then
    raise exception 'Storage bucket liga-images is missing; refusing to apply upload restrictions.';
  end if;
end;
$preflight$;

update storage.buckets
set file_size_limit = 52428800,
    allowed_mime_types = array[
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'image/avif',
      'video/mp4',
      'video/webm',
      'video/ogg'
    ]::text[]
where id = 'liga-images';

drop policy if exists liga_images_user_insert on storage.objects;
create policy liga_images_user_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'liga-images'
  and (
    name like ('avatars/' || (select auth.uid())::text || '/%')
    or name like ('community/' || (select auth.uid())::text || '/%')
    or name like ('stories/' || (select auth.uid())::text || '/%')
    or name like ('comments/' || (select auth.uid())::text || '/%')
    or name like ('chat/' || (select auth.uid())::text || '/%')
  )
  and lower(coalesce(metadata->>'mimetype','')) = any(array[
    'image/jpeg','image/png','image/webp','image/gif','image/avif'
  ]::text[])
  and case
    when coalesce(metadata->>'size','') ~ '^[0-9]+$'
      then (metadata->>'size')::bigint <= 12582912
    else false
  end
);

commit;
