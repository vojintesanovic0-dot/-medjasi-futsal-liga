-- Fix editor uploads of News/Gallery media.
-- PostgreSQL regex patterns use [.] for a literal dot; this avoids the
-- double-backslash pattern that rejected otherwise valid UUID filenames.
-- Storage can evaluate INSERT RLS before metadata.size is reliably present,
-- so do not reject valid uploads based on that field at INSERT time.
-- Keep editor-role, exact path/UUID, MIME/extension, bucket and bucket-level
-- 50 MiB maximum restrictions. The app additionally limits images to 15 MiB.
begin;

do $preflight$
begin
  if not exists (
    select 1 from storage.buckets
    where id = 'liga-images' and file_size_limit <= 52428800
  ) then
    raise exception 'Storage bucket liga-images is missing or its maximum upload limit exceeds 50 MiB; refusing to change editor upload policy.';
  end if;
  if to_regprocedure('public.is_content_editor()') is null then
    raise exception 'public.is_content_editor() is missing; apply the content editor role migration first.';
  end if;
end;
$preflight$;

drop policy if exists liga_images_editor_media_insert on storage.objects;

create policy liga_images_editor_media_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'liga-images'
  and (select public.is_content_editor())
  and name ~ '^(gallery|news)/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.](jpg|png|webp|gif|avif|mp4|webm|ogv)$'
  and (
    (lower(coalesce(metadata->>'mimetype','')) = 'image/jpeg' and name ~ '[.]jpg$')
    or (lower(coalesce(metadata->>'mimetype','')) = 'image/png' and name ~ '[.]png$')
    or (lower(coalesce(metadata->>'mimetype','')) = 'image/webp' and name ~ '[.]webp$')
    or (lower(coalesce(metadata->>'mimetype','')) = 'image/gif' and name ~ '[.]gif$')
    or (lower(coalesce(metadata->>'mimetype','')) = 'image/avif' and name ~ '[.]avif$')
    or (lower(coalesce(metadata->>'mimetype','')) = 'video/mp4' and name ~ '[.]mp4$')
    or (lower(coalesce(metadata->>'mimetype','')) = 'video/webm' and name ~ '[.]webm$')
    or (lower(coalesce(metadata->>'mimetype','')) = 'video/ogg' and name ~ '[.]ogv$')
  )
);

commit;
