-- 05: server-side zaštita od spama (chat/komentari) + admin audit log.
-- Idempotentno. Pokreni nakon 01/02/03/04.

begin;

create or replace function public.medjasi_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  last_at timestamptz;
  cnt int;
  uid uuid := auth.uid();
begin
  if uid is null or public.fan_is_admin() then
    return new;
  end if;

  execute format(
    'select max(created_at), count(*) filter (where created_at > now() - interval ''1 minute'')
       from %I.%I where user_id = $1 and created_at > now() - interval ''1 minute''',
    tg_table_schema, tg_table_name)
  into last_at, cnt
  using uid;

  if last_at is not null and last_at > now() - interval '2 seconds' then
    raise exception 'Prebrzo šalješ. Pričekaj nekoliko sekundi.' using errcode = 'P0001';
  end if;
  if coalesce(cnt,0) >= 10 then
    raise exception 'Previše poruka u kratkom roku. Pokušaj za minut.' using errcode = 'P0001';
  end if;

  return new;
end $$;

revoke all on function public.medjasi_rate_limit() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['messages','comments'] loop
    if to_regclass('public.'||t) is not null
       and exists (select 1 from information_schema.columns
                   where table_schema='public' and table_name=t and column_name='user_id')
       and exists (select 1 from information_schema.columns
                   where table_schema='public' and table_name=t and column_name='created_at') then
      execute format('drop trigger if exists medjasi_rate_limit_%1$s on public.%1$I', t);
      execute format('create trigger medjasi_rate_limit_%1$s before insert on public.%1$I
                      for each row execute function public.medjasi_rate_limit()', t);
    end if;
  end loop;
end $$;

create table if not exists public.admin_audit_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  actor uuid,
  table_name text not null,
  op text not null,
  row_id text,
  old_data jsonb,
  new_data jsonb
);

create index if not exists admin_audit_log_created_idx
  on public.admin_audit_log (created_at desc);

alter table public.admin_audit_log enable row level security;

drop policy if exists admin_audit_select on public.admin_audit_log;
create policy admin_audit_select
on public.admin_audit_log for select to authenticated
using ((select public.fan_is_admin()));

create or replace function public.medjasi_audit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  rec jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
  insert into public.admin_audit_log (actor, table_name, op, row_id, old_data, new_data)
  values (
    auth.uid(), tg_table_name, tg_op, rec->>'id',
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end
  );
  return null;
end $$;

revoke all on function public.medjasi_audit() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['matches','goals','cards','match_players','teams','players','news','gallery'] loop
    if to_regclass('public.'||t) is not null then
      execute format('drop trigger if exists medjasi_audit_%1$s on public.%1$I', t);
      execute format('create trigger medjasi_audit_%1$s after insert or update or delete on public.%1$I
                      for each row execute function public.medjasi_audit()', t);
    end if;
  end loop;
end $$;

commit;
