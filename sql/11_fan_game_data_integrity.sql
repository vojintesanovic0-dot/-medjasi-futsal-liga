-- Fan Game table-level integrity.
-- These checks mirror limits enforced by the server-side RPC functions.

begin;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid='public.fan_picks'::regclass and conname='fan_picks_stake_range_check') then
    alter table public.fan_picks add constraint fan_picks_stake_range_check check (stake between 1 and 50);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.fan_picks'::regclass and conname='fan_picks_odds_range_check') then
    alter table public.fan_picks add constraint fan_picks_odds_range_check check (odds between 1.01 and 100);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.fan_picks'::regclass and conname='fan_picks_payout_nonnegative_check') then
    alter table public.fan_picks add constraint fan_picks_payout_nonnegative_check check (payout >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.fan_picks'::regclass and conname='fan_picks_status_check') then
    alter table public.fan_picks add constraint fan_picks_status_check check (status in ('open','won','lost','void'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.fan_markets'::regclass and conname='fan_markets_odds_range_check') then
    alter table public.fan_markets add constraint fan_markets_odds_range_check check (odds between 1.01 and 100);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.fan_markets'::regclass and conname='fan_markets_status_check') then
    alter table public.fan_markets add constraint fan_markets_status_check check (status in ('open','suspended','won','lost','void'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.fan_wallets'::regclass and conname='fan_wallets_balance_nonnegative_check') then
    alter table public.fan_wallets add constraint fan_wallets_balance_nonnegative_check check (balance >= 0);
  end if;
end $$;

commit;
