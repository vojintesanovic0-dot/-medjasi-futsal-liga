-- Keep public News readable without granting anonymous EXECUTE on the admin helper.
-- The old combined anon/authenticated policy called public.is_admin() for both roles.
-- Since anon is intentionally denied EXECUTE on that helper, PostgREST returned 401
-- for public News reads. Separate policies preserve the intended public/admin behavior.
begin;

do $preflight$
begin
  if to_regclass('public.news') is null then
    raise exception 'Expected public.news table was not found; refusing to change News read policies.';
  end if;
  if to_regprocedure('public.is_admin()') is null then
    raise exception 'Expected public.is_admin() helper was not found; apply the role-security migrations first.';
  end if;
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'news'
      and column_name = 'published'
  ) then
    raise exception 'Expected public.news.published column was not found; refusing to change News read policies.';
  end if;
end;
$preflight$;

drop policy if exists news_public_read on public.news;
drop policy if exists news_public_read_anon on public.news;
drop policy if exists news_public_read_authenticated on public.news;

create policy news_public_read_anon
on public.news
for select
to anon
using (published = true);

create policy news_public_read_authenticated
on public.news
for select
to authenticated
using (
  published = true
  or (select public.is_admin())
);

commit;

-- Verification: anonymous REST reads should succeed and return only published rows.
-- Authenticated non-admins should see published rows; admins can also see drafts.
