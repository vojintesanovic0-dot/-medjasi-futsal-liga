-- Live match clock formats and pause/resume support.
-- Existing matches default to a single 60-minute clock; admins can select 2x20.
begin;

alter table public.matches
  add column if not exists match_format text not null default '60min',
  add column if not exists paused_at timestamptz,
  add column if not exists paused_seconds integer not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.matches'::regclass
      and conname='matches_match_format_check'
  ) then
    alter table public.matches
      add constraint matches_match_format_check
      check (match_format in ('60min','2x20'));
  end if;
end $$;

commit;
