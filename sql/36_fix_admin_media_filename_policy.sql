-- Fix admin uploads of News/Gallery media.
-- Use PostgreSQL-safe [.] extension patterns and do not require metadata.size
-- during INSERT, because Storage may not provide that field at policy-check time.
begin;

do $preflight$
begin
  if not exists (
    select 1 from storage.buckets
    where id = 'liga-images' and file_size_limit <= 52428800
  ) then
    raise exception 'Storage bucket liga-images is missing or its maximum upload limit exceeds 50 MiB; refusing to change admin upload policy.';
  end if;
  if to_regprocedure('public.fan_is_admin()') is null then
    raise exception 'public.fan_is_admin() is missing; refusing to change admin upload policy.';
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
  and (
    name ~ '^(gallery|news|teams|players)/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.](jpg|png|webp|gif|avif)$'
    or name ~ '^(gallery|news)/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.](mp4|webm|ogv)$'
    or name ~ '^players/[A-Za-z0-9_-]+/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.](jpg|png|webp|gif|avif)$'
  )
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
