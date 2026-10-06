-- Consolidate authenticated SELECT policies for the two tables flagged by
-- Supabase's multiple_permissive_policies performance advisor.

begin;

drop policy if exists fan_shop_admin on public.fan_shop_items;
drop policy if exists fan_shop_read_auth on public.fan_shop_items;

create policy fan_shop_select_auth
on public.fan_shop_items
for select
to authenticated
using (active = true or (select public.fan_is_admin()));

create policy fan_shop_admin_insert
on public.fan_shop_items
for insert
to authenticated
with check ((select public.fan_is_admin()));

create policy fan_shop_admin_update
on public.fan_shop_items
for update
to authenticated
using ((select public.fan_is_admin()))
with check ((select public.fan_is_admin()));

create policy fan_shop_admin_delete
on public.fan_shop_items
for delete
to authenticated
using ((select public.fan_is_admin()));

drop policy if exists sponsors_admin on public.sponsors;
drop policy if exists sponsors_read_auth on public.sponsors;

create policy sponsors_select_auth
on public.sponsors
for select
to authenticated
using (active = true or (select public.fan_is_admin()));

create policy sponsors_admin_insert
on public.sponsors
for insert
to authenticated
with check ((select public.fan_is_admin()));

create policy sponsors_admin_update
on public.sponsors
for update
to authenticated
using ((select public.fan_is_admin()))
with check ((select public.fan_is_admin()));

create policy sponsors_admin_delete
on public.sponsors
for delete
to authenticated
using ((select public.fan_is_admin()));

commit;
