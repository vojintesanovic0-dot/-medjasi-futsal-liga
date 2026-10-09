-- Close the race between accepting a pick and finalizing a match.
-- The same match row lock is used before status validation.
begin;

do $guard$
begin
  if to_regprocedure('private.fan_place_pick(uuid,integer,boolean)') is null then
    raise exception 'private.fan_place_pick is missing; apply sql/01_fan_game.sql and sql/02_security_hardening.sql first.';
  end if;
end $guard$;

create or replace function private.fan_place_pick(p_market uuid, p_stake int, p_boost boolean default false)
returns jsonb language plpgsql security definer set search_path = private, public, pg_temp as $fan_pick$
declare
  v_uid uuid := auth.uid(); m fan_markets; mt record; v_bal int; v_id uuid;
begin
  if v_uid is null then raise exception 'Prijavi se.'; end if;
  perform fan_ensure_wallet();
  select * into m from fan_markets where id = p_market;
  if not found or m.status <> 'open' then raise exception 'Ovaj pogodak više nije dostupan.'; end if;
  select * into mt from matches where id::text = m.match_id for update;
  if not found then raise exception 'Utakmica ne postoji.'; end if;
  if mt.status not in ('scheduled','live') then
    raise exception 'Pogađanje za ovu utakmicu je zatvoreno.';
  end if;
  if mt.status = 'scheduled' and mt.match_date is not null and mt.match_date <= now() then
    raise exception 'Utakmica je trebala početi. Čekaj da se otvore live kvote.';
  end if;
  if mt.status = 'live' and coalesce(mt.current_minute,0) >= 60 then
    raise exception 'Utakmica je završila. Pogađanje je zatvoreno.';
  end if;
  if p_stake is null or p_stake < 1 or p_stake > 50 then
    raise exception 'Možeš uložiti od 1 do 50 poena po pogotku.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('fan-pick:' || v_uid::text || ':' || m.match_id, 0));
  if m.kind in ('result','total','red_card','exact') and exists (
      select 1 from fan_picks where user_id = v_uid and match_id = m.match_id and kind = m.kind) then
    raise exception 'U ovoj grupi si već pogodio.';
  end if;
  if p_boost and exists (
      select 1 from fan_picks fp join matches mm on mm.id::text = fp.match_id
      where fp.user_id = v_uid and fp.boosted and mm.round is not distinct from mt.round) then
    raise exception 'Pojačivač si već iskoristio u ovom kolu.';
  end if;
  select balance into v_bal from fan_wallets where user_id = v_uid for update;
  if v_bal < p_stake then raise exception 'Nemaš dovoljno poena.'; end if;

  update fan_wallets set balance = balance - p_stake where user_id = v_uid;
  insert into fan_picks(user_id, market_id, match_id, kind, stake, odds, boosted)
    values (v_uid, m.id, m.match_id, m.kind, p_stake, m.odds, coalesce(p_boost, false))
    returning id into v_id;
  insert into fan_ledger(user_id, delta, reason, ref)
    values (v_uid, -p_stake, 'Pogodak: ' || m.label, m.match_id);
  return jsonb_build_object('pick_id', v_id, 'balance', v_bal - p_stake);
end $fan_pick$;

commit;
