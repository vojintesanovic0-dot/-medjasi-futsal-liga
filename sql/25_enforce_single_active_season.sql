-- Enforce the application invariant that there can be only one active
-- season at a time. Inactive seasons are unaffected.
-- The preflight intentionally aborts instead of silently changing production data.
begin;

do $preflight$
begin
  if exists (
    select 1
    from public.seasons
    where is_active is true
    group by is_active
    having count(*) > 1
  ) then
    raise exception 'More than one active season exists. Resolve duplicate active seasons before applying this constraint.';
  end if;
end;
$preflight$;

create unique index if not exists seasons_only_one_active_idx
  on public.seasons (is_active)
  where is_active is true;

commit;
