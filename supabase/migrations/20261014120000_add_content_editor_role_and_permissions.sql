-- Dedicated editorial role for news and gallery only.
-- Admin and moderator permissions remain unchanged.

begin;

create or replace function public.is_content_editor()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $function$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.role in ('admin', 'editor')
  );
$function$;

revoke all on function public.is_content_editor() from public, anon;
grant execute on function public.is_content_editor() to authenticated;

drop policy if exists news_editor_read_all on public.news;
create policy news_editor_read_all on public.news
for select to authenticated using (public.is_content_editor());

drop policy if exists news_editor_insert on public.news;
create policy news_editor_insert on public.news
for insert to authenticated
with check (public.is_content_editor() and (author_id = (select auth.uid()) or public.is_admin()));

drop policy if exists news_editor_update on public.news;
create policy news_editor_update on public.news
for update to authenticated using (public.is_content_editor())
with check (public.is_content_editor());

drop policy if exists news_editor_delete on public.news;
create policy news_editor_delete on public.news
for delete to authenticated using (public.is_content_editor());

drop policy if exists gallery_editor_insert on public.gallery;
create policy gallery_editor_insert on public.gallery
for insert to authenticated
with check (public.is_content_editor() and (created_by = (select auth.uid()) or public.is_admin()));

drop policy if exists gallery_editor_update on public.gallery;
create policy gallery_editor_update on public.gallery
for update to authenticated using (public.is_content_editor())
with check (public.is_content_editor());

drop policy if exists gallery_editor_delete on public.gallery;
create policy gallery_editor_delete on public.gallery
for delete to authenticated using (public.is_content_editor());

drop policy if exists liga_images_editor_media_insert on storage.objects;
create policy liga_images_editor_media_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'liga-images'
  and public.is_content_editor()
  and (
    (name ~ '^(gallery|news)/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp|gif|avif)$')
    or (name ~ '^(gallery|news)/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(mp4|webm|ogv)$')
  )
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
        when lower(coalesce(metadata->>'mimetype','')) like 'image/%' then (metadata->>'size')::bigint <= 15728640
        when lower(coalesce(metadata->>'mimetype','')) like 'video/%' then (metadata->>'size')::bigint <= 52428800
        else false
      end
    else false
  end
);

drop policy if exists liga_images_editor_media_update on storage.objects;
create policy liga_images_editor_media_update on storage.objects
for update to authenticated
using (bucket_id = 'liga-images' and public.is_content_editor() and (name like 'gallery/%' or name like 'news/%'))
with check (bucket_id = 'liga-images' and public.is_content_editor() and (name like 'gallery/%' or name like 'news/%'));

drop policy if exists liga_images_editor_media_delete on storage.objects;
create policy liga_images_editor_media_delete on storage.objects
for delete to authenticated
using (bucket_id = 'liga-images' and public.is_content_editor() and (name like 'gallery/%' or name like 'news/%'));

update public.profiles
set role = 'editor'
where id = 'a7e916b5-cdea-4a09-a5b9-dc5094a863e6'
  and lower(username) = 'urednica';

commit;
