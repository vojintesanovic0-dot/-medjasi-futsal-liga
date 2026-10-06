-- =====================================================================
-- MEDJAŠI FUTSAL LIGA – "Pogodi" igra, poeni, prodavnica, MVP, ekipe, sponzori
-- Poeni su ISKLJUČIVO virtuelni (bez uplate i bez isplate).
--
-- PRETPOSTAVKE O TVOJOJ ŠEMI (provjeri sa ispisom šeme prije pokretanja):
--   profiles(id uuid = auth.users.id, username, role)   role = 'admin'
--   matches(id, status['scheduled'|'live'|'finished'], home_score, away_score,
--           match_date, round, home_team_id, away_team_id)
--   goals(match_id, player_id, assist_player_id)
--   cards(match_id, player_id, card_type['yellow'|'red'])
--   players(id, team_id, + kolona imena: name | full_name | player_name)
--   match_players(match_id, player_id)   (opcionalno, koristi se za "nije igrao")
-- Sve veze na tvoje tabele rade preko ::text, pa radi i uuid i bigint ID.
-- Skriptu je sigurno pokrenuti više puta.
-- =====================================================================

create or replace function public.fan_is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- ---------------------------------------------------------------- TABELE
create table if not exists public.fan_wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance int not null default 100 check (balance >= 0),
  last_daily date,
  created_at timestamptz not null default now()
);

create table if not exists public.fan_ledger (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  delta int not null,
  reason text not null,
  ref text,
  created_at timestamptz not null default now()
);
create index if not exists fan_ledger_user_idx on public.fan_ledger(user_id, created_at desc);

create table if not exists public.fan_markets (
  id uuid primary key default gen_random_uuid(),
  match_id text not null,
  kind text not null check (kind in ('result','total','red_card','exact','scorer','player_2plus')),
  selection text not null,
  label text not null,
  line numeric,
  player_id text,
  odds numeric(6,2) not null check (odds >= 1.01),
  status text not null default 'open' check (status in ('open','won','lost','void')),
  created_at timestamptz not null default now(),
  unique (match_id, kind, selection)
);
create index if not exists fan_markets_match_idx on public.fan_markets(match_id);

create table if not exists public.fan_picks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  market_id uuid not null references public.fan_markets(id) on delete cascade,
  match_id text not null,
  kind text not null,
  stake int not null check (stake > 0),
  odds numeric(6,2) not null,
  boosted boolean not null default false,
  status text not null default 'open' check (status in ('open','won','lost','void')),
  payout int not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, market_id)
);
create index if not exists fan_picks_user_idx on public.fan_picks(user_id, created_at desc);
create unique index if not exists fan_picks_one_core_kind_idx on public.fan_picks(user_id, match_id, kind) where kind in ('result','total','red_card','exact');

create table if not exists public.fan_shop_items (
  id serial primary key,
  kind text not null check (kind in ('name_color','frame','badge','title','emoji_pack')),
  name text not null,
  description text,
  price int not null check (price > 0),
  value text not null,
  active boolean not null default true,
  unique(kind, name)
);

create table if not exists public.fan_inventory (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id int not null references public.fan_shop_items(id) on delete cascade,
  equipped boolean not null default false,
  acquired_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

create table if not exists public.fan_mvp_votes (
  match_id text not null,
  voter uuid not null references auth.users(id) on delete cascade,
  player_id text not null,
  weight int not null default 1,
  created_at timestamptz not null default now(),
  primary key (match_id, voter)
);

create table if not exists public.fan_team_follows (
  user_id uuid not null references auth.users(id) on delete cascade,
  team_id text not null,
  primary key (user_id, team_id)
);

create table if not exists public.fan_team_fund (
  team_id text primary key,
  total int not null default 0 check (total >= 0)
);

create table if not exists public.sponsors (
  id serial primary key,
  name text not null,
  logo_url text,
  link_url text,
  sort_order int not null default 0,
  active boolean not null default true
);

create table if not exists public.team_applications (
  id serial primary key,
  user_id uuid references auth.users(id) on delete set null,
  team_name text not null,
  captain_name text not null,
  phone text not null,
  note text,
  status text not null default 'new' check (status in ('new','reviewing','accepted','rejected')),
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------------- RLS
alter table public.fan_wallets      enable row level security;
alter table public.fan_ledger       enable row level security;
alter table public.fan_markets      enable row level security;
alter table public.fan_picks        enable row level security;
alter table public.fan_shop_items   enable row level security;
alter table public.fan_inventory    enable row level security;
alter table public.fan_mvp_votes    enable row level security;
alter table public.fan_team_follows enable row level security;
alter table public.fan_team_fund    enable row level security;
alter table public.sponsors         enable row level security;
alter table public.team_applications enable row level security;

drop policy if exists fan_wallets_own   on public.fan_wallets;
drop policy if exists fan_ledger_own    on public.fan_ledger;
drop policy if exists fan_markets_read  on public.fan_markets;
drop policy if exists fan_picks_own     on public.fan_picks;
drop policy if exists fan_shop_read     on public.fan_shop_items;
drop policy if exists fan_shop_admin    on public.fan_shop_items;
drop policy if exists fan_inv_own       on public.fan_inventory;
drop policy if exists fan_mvp_own       on public.fan_mvp_votes;
drop policy if exists fan_follow_all    on public.fan_team_follows;
drop policy if exists fan_fund_read     on public.fan_team_fund;
drop policy if exists sponsors_read     on public.sponsors;
drop policy if exists sponsors_admin    on public.sponsors;
drop policy if exists apps_insert       on public.team_applications;
drop policy if exists apps_admin_read   on public.team_applications;
drop policy if exists apps_admin_update on public.team_applications;

-- Novčanik, istorija, pogodci, inventar: samo čitanje svojih redova. Upis ISKLJUČIVO preko funkcija ispod.
create policy fan_wallets_own on public.fan_wallets for select to authenticated using (user_id = (select auth.uid()) or (select public.fan_is_admin()));
create policy fan_ledger_own on public.fan_ledger for select to authenticated using (user_id = (select auth.uid()) or (select public.fan_is_admin()));
create policy fan_picks_own on public.fan_picks for select to authenticated using (user_id = (select auth.uid()) or (select public.fan_is_admin()));
create policy fan_inv_own on public.fan_inventory for select to authenticated using (user_id = (select auth.uid()));
create policy fan_mvp_own on public.fan_mvp_votes for select to authenticated using (voter = (select auth.uid()));
create policy fan_markets_read on public.fan_markets for select to anon, authenticated using (true);
create policy fan_shop_read on public.fan_shop_items for select to anon, authenticated using (active or (select public.fan_is_admin()));
create policy fan_shop_admin on public.fan_shop_items for all to authenticated using ((select public.fan_is_admin())) with check ((select public.fan_is_admin()));
create policy fan_follow_all on public.fan_team_follows for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy fan_fund_read on public.fan_team_fund for select to anon, authenticated using (true);
create policy sponsors_read on public.sponsors for select to anon, authenticated using (active or (select public.fan_is_admin()));
create policy sponsors_admin on public.sponsors for all to authenticated using ((select public.fan_is_admin())) with check ((select public.fan_is_admin()));
create policy apps_insert on public.team_applications for insert to authenticated with check ((select auth.uid()) is not null and user_id = (select auth.uid()));
create policy apps_admin_read on public.team_applications for select to authenticated using ((select public.fan_is_admin()) or user_id = (select auth.uid()));
create policy apps_admin_update on public.team_applications for update to authenticated using ((select public.fan_is_admin())) with check ((select public.fan_is_admin()));

-- ----------------------------------------------------- JAVNI FAN IZGLED
create or replace function public.fan_public_cosmetics(p_users uuid[])
returns table(user_id uuid, name_color text, frame text, badge text, title text, emoji_pack text)
language sql stable security definer set search_path = public
as $
  select i.user_id,
    max(s.value) filter (where s.kind='name_color'),
    max(s.value) filter (where s.kind='frame'),
    max(s.value) filter (where s.kind='badge'),
    max(s.value) filter (where s.kind='title'),
    max(s.value) filter (where s.kind='emoji_pack')
  from public.fan_inventory i
  join public.fan_shop_items s on s.id=i.item_id
  where i.equipped and s.active and i.user_id = any(coalesce(p_users, '{}'::uuid[]))
  group by i.user_id;
$;

revoke all on function public.fan_public_cosmetics(uuid[]) from public;
grant execute on function public.fan_public_cosmetics(uuid[]) to authenticated;

-- ------------------------------------------------------------- FUNKCIJE
create or replace function public.fan_ensure_wallet() returns int
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_bal int;
begin
  if v_uid is null then raise exception 'Prijavi se.'; end if;
  insert into fan_wallets(user_id) values (v_uid) on conflict do nothing;
  if found then
    insert into fan_ledger(user_id, delta, reason) values (v_uid, 100, 'Početni poeni');
  end if;
  select balance into v_bal from fan_wallets where user_id = v_uid;
  return v_bal;
end $$;

create or replace function public.fan_claim_daily() returns int
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_last date; v_bal int;
begin
  if v_uid is null then raise exception 'Prijavi se.'; end if;
  perform fan_ensure_wallet();
  select last_daily into v_last from fan_wallets where user_id = v_uid for update;
  if v_last = current_date then raise exception 'Dnevni bonus si već uzeo. Vrati se sutra.'; end if;
  update fan_wallets set balance = balance + 10, last_daily = current_date
    where user_id = v_uid returning balance into v_bal;
  insert into fan_ledger(user_id, delta, reason) values (v_uid, 10, 'Dnevni bonus');
  return v_bal;
end $$;

create or replace function public.fan_place_pick(p_market uuid, p_stake int, p_boost boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid(); m fan_markets; mt record; v_bal int; v_id uuid;
begin
  if v_uid is null then raise exception 'Prijavi se.'; end if;
  perform fan_ensure_wallet();
  select * into m from fan_markets where id = p_market;
  if not found or m.status <> 'open' then raise exception 'Ovaj pogodak više nije dostupan.'; end if;
  select * into mt from matches where id::text = m.match_id;
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
end $$;

create or replace function public.fan_generate_markets(p_match text) returns int
language plpgsql security definer set search_path = public as $$
declare mt record; n int := 0; r record; sc text; v_name text;
begin
  if not fan_is_admin() then raise exception 'Samo admin.'; end if;
  select * into mt from matches where id::text = p_match;
  if not found then raise exception 'Utakmica ne postoji.'; end if;

  insert into fan_markets(match_id, kind, selection, label, odds) values
    (p_match,'result','1','Pobjeda domaćina',2.20),
    (p_match,'result','X','Neriješeno',3.40),
    (p_match,'result','2','Pobjeda gosta',2.20)
  on conflict do nothing;
  insert into fan_markets(match_id, kind, selection, label, line, odds) values
    (p_match,'total','over','Više od 3.5 golova',3.5,1.90),
    (p_match,'total','under','Manje od 3.5 golova',3.5,1.90)
  on conflict do nothing;
  insert into fan_markets(match_id, kind, selection, label, odds) values
    (p_match,'red_card','yes','Biće crvenog kartona',3.50),
    (p_match,'red_card','no','Neće biti crvenog kartona',1.25)
  on conflict do nothing;

  foreach sc in array array['1:0','0:1','1:1','2:0','0:2','2:1','1:2','2:2','3:1','1:3','3:2','2:3'] loop
    insert into fan_markets(match_id, kind, selection, label, odds)
      values (p_match, 'exact', sc, 'Tačan rezultat ' || sc, 8.00)
      on conflict do nothing;
  end loop;

  for r in select p.* from players p
           where p.team_id::text in (mt.home_team_id::text, mt.away_team_id::text) loop
    v_name := coalesce(to_jsonb(r)->>'name', to_jsonb(r)->>'full_name', to_jsonb(r)->>'player_name', 'Igrač');
    insert into fan_markets(match_id, kind, selection, label, player_id, odds)
      values (p_match,'scorer', r.id::text, v_name||' daje gol', r.id::text, 2.60) on conflict do nothing;
    insert into fan_markets(match_id, kind, selection, label, player_id, odds)
      values (p_match,'player_2plus', r.id::text, v_name||' daje 2+ gola', r.id::text, 7.00) on conflict do nothing;
  end loop;

  perform public.fan_reprice_match_odds(p_match);
  select count(*) into n from fan_markets where match_id = p_match;
  return n;
end $$;

-- ------------------------------------------------ LIVE KVOTE
create or replace function public.fan_reprice_match_odds(p_match text)
returns void language plpgsql security definer set search_path = public as $
declare mt record; mk record; home_avg numeric:=1.5; away_avg numeric:=1.5; home_def numeric:=1.5; away_def numeric:=1.5; home_strength numeric:=1; away_strength numeric:=1; ph numeric; pd numeric; pa numeric; total numeric; minute numeric; hs int; aw int; red_count int; red_home int; red_away int; score_adj numeric; p numeric; line numeric;
begin
  select * into mt from matches where id::text=p_match; if not found then return; end if;
  hs:=coalesce(mt.home_score,0); aw:=coalesce(mt.away_score,0); minute:=greatest(0,least(60,coalesce(mt.current_minute,0)));
  select coalesce(avg(case when home_team_id=mt.home_team_id then home_score end),1.5), coalesce(avg(case when away_team_id=mt.away_team_id then away_score end),1.5), coalesce(avg(case when home_team_id=mt.home_team_id then away_score end),1.5), coalesce(avg(case when away_team_id=mt.away_team_id then home_score end),1.5) into home_avg,away_avg,home_def,away_def from matches where status='finished' and (home_team_id=mt.home_team_id or away_team_id=mt.home_team_id or home_team_id=mt.away_team_id or away_team_id=mt.away_team_id);
  home_strength:=greatest(.55,least(1.9,(home_avg+away_def)/3.0)); away_strength:=greatest(.55,least(1.9,(away_avg+home_def)/3.0));
  ph:=.43*home_strength/greatest(.75,home_strength+away_strength)+.08; pa:=.43*away_strength/greatest(.75,home_strength+away_strength); pd:=greatest(.08,1-ph-pa);
  if mt.status='live' then
    score_adj:=(hs-aw)*.12+((minute-30)/60.0)*.03; ph:=greatest(.04,least(.92,ph+score_adj)); pa:=greatest(.04,least(.92,pa-score_adj)); pd:=greatest(.04,1-ph-pa);
    select count(*) filter (where p.team_id::text=mt.home_team_id::text), count(*) filter (where p.team_id::text=mt.away_team_id::text) into red_home,red_away from cards c join players p on p.id=c.player_id where c.match_id::text=p_match and lower(c.card_type)='red';
    if red_home>red_away then ph:=greatest(.03,ph-.10); pa:=least(.94,pa+.07); pd:=greatest(.03,1-ph-pa); elsif red_away>red_home then pa:=greatest(.03,pa-.10); ph:=least(.94,ph+.07); pd:=greatest(.03,1-ph-pa); end if;
  end if;
  total:=ph+pd+pa; ph:=ph/total; pd:=pd/total; pa:=pa/total;
  for mk in select * from fan_markets where match_id=p_match and status='open' loop
    p:=null;
    if mk.kind='result' then p:=case mk.selection when '1' then ph when 'X' then pd when '2' then pa end;
    elsif mk.kind='total' then line:=coalesce(mk.line,3.5); p:=case when mk.selection='over' then greatest(.12,least(.88,.50+((hs+aw)-line)*.12+minute*.002)) else greatest(.12,least(.88,.50-((hs+aw)-line)*.12-minute*.002)) end;
    elsif mk.kind='red_card' then select count(*) into red_count from cards where match_id::text=p_match and lower(card_type)='red'; p:=case when mk.selection='yes' then greatest(.08,least(.90,.22+red_count*.30+minute*.003)) else greatest(.10,least(.92,.78-red_count*.30-minute*.003)) end;
    elsif mk.kind='exact' then p:=case when mk.selection=hs||':'||aw then .08 else .015 end;
    elsif mk.kind='scorer' then p:=greatest(.08,least(.75,.28-minute*.002+coalesce((select count(*) from goals where match_id::text=p_match and player_id::text=mk.player_id),0)*.20));
    elsif mk.kind='player_2plus' then p:=greatest(.02,least(.35,.10-minute*.001+coalesce((select count(*) from goals where match_id::text=p_match and player_id::text=mk.player_id),0)*.10)); end if;
    if p is not null then update fan_markets set odds=round(greatest(1.05,least(100,(1.0/p)*1.05))::numeric,2) where id=mk.id and status='open'; end if;
  end loop;
end $;

create or replace function public.fan_market_event_reprice() returns trigger language plpgsql security definer set search_path=public as $ begin perform public.fan_reprice_match_odds(coalesce(new.match_id::text,old.match_id::text)); return coalesce(new,old); end $;
drop trigger if exists fan_reprice_on_match on public.matches; create trigger fan_reprice_on_match after update of home_score,away_score,current_minute,status on public.matches for each row execute function public.fan_market_event_reprice();
drop trigger if exists fan_reprice_on_goal on public.goals; create trigger fan_reprice_on_goal after insert or update or delete on public.goals for each row execute function public.fan_market_event_reprice();
drop trigger if exists fan_reprice_on_card on public.cards; create trigger fan_reprice_on_card after insert or update or delete on public.cards for each row execute function public.fan_market_event_reprice();
revoke all on function public.fan_reprice_match_odds(text),public.fan_market_event_reprice() from public,anon,authenticated;
create or replace function public.fan_set_odds(p_market uuid, p_odds numeric) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not fan_is_admin() then raise exception 'Samo admin.'; end if;
  if p_odds < 1.01 or p_odds > 100 then raise exception 'Kvota mora biti između 1.01 i 100.'; end if;
  update fan_markets set odds = p_odds where id = p_market and status = 'open';
end $$;

create or replace function public.fan_settle_match(p_match text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  mt record; mk fan_markets; pk fan_picks;
  hs int; aw int; tot int; red boolean; res boolean; pay int; st text; played boolean;
  v_markets int := 0; v_picks int := 0; v_paid int := 0; has_lineup boolean;
begin
  if not fan_is_admin() then raise exception 'Samo admin.'; end if;
  select * into mt from matches where id::text = p_match;
  if not found then raise exception 'Utakmica ne postoji.'; end if;
  if mt.status is distinct from 'finished' then raise exception 'Utakmica još nije završena.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('fan-settle:' || p_match, 0));

  hs := coalesce(mt.home_score,0); aw := coalesce(mt.away_score,0); tot := hs + aw;
  red := exists (select 1 from cards where match_id::text = p_match and lower(card_type::text) = 'red');
  has_lineup := exists (select 1 from match_players where match_id::text = p_match);

  for mk in select * from fan_markets where match_id = p_match and status = 'open' loop
    res := null;
    if mk.kind = 'result' then
      res := mk.selection = case when hs > aw then '1' when hs < aw then '2' else 'X' end;
    elsif mk.kind = 'total' then
      res := case when mk.selection = 'over' then tot > mk.line else tot < mk.line end;
    elsif mk.kind = 'red_card' then
      res := (mk.selection = 'yes') = red;
    elsif mk.kind = 'exact' then
      res := mk.selection = hs || ':' || aw;
    elsif mk.kind in ('scorer','player_2plus') then
      played := exists (select 1 from match_players where match_id::text = p_match and player_id::text = mk.player_id);
      if has_lineup and not played then
        res := null;  -- igrač nije bio u sastavu: poništeno, poeni se vraćaju
      elsif mk.kind = 'scorer' then
        res := exists (select 1 from goals where match_id::text = p_match and player_id::text = mk.player_id);
      else
        res := (select count(*) from goals where match_id::text = p_match and player_id::text = mk.player_id) >= 2;
      end if;
    end if;

    update fan_markets set status = case when res is null then 'void' when res then 'won' else 'lost' end
      where id = mk.id;
    v_markets := v_markets + 1;

    for pk in select * from fan_picks where market_id = mk.id and status = 'open' loop
      if res is null then
        pay := pk.stake; st := 'void';
      elsif res then
        pay := floor(pk.stake * pk.odds * case when pk.boosted then 1.5 else 1 end)::int; st := 'won';
      else
        pay := 0; st := 'lost';
      end if;
      update fan_picks set status = st, payout = pay where id = pk.id;
      if pay > 0 then
        update fan_wallets set balance = balance + pay where user_id = pk.user_id;
        insert into fan_ledger(user_id, delta, reason, ref)
          values (pk.user_id, pay, case when st = 'void' then 'Povrat: ' else 'Dobitak: ' end || mk.label, p_match);
        v_paid := v_paid + pay;
      end if;
      v_picks := v_picks + 1;
    end loop;
  end loop;
  return jsonb_build_object('markets', v_markets, 'picks', v_picks, 'paid', v_paid);
end $$;

create or replace function public.fan_admin_grant(p_user uuid, p_amount int, p_reason text) returns int
language plpgsql security definer set search_path = public as $$
declare v_bal int;
begin
  if not fan_is_admin() then raise exception 'Samo admin.'; end if;
  if p_user is null or not exists (select 1 from auth.users where id = p_user) then raise exception 'Korisnik ne postoji.'; end if;
  if p_amount is null or p_amount = 0 or abs(p_amount) > 1000 then raise exception 'Iznos mora biti od -1000 do 1000 (ne nula).'; end if;
  if coalesce(trim(p_reason),'') = '' then raise exception 'Upiši razlog.'; end if;
  insert into fan_wallets(user_id) values (p_user) on conflict do nothing;
  select balance into v_bal from fan_wallets where user_id = p_user for update;
  if p_amount < 0 and v_bal < abs(p_amount) then raise exception 'Korisnik nema dovoljno poena.'; end if;
  update fan_wallets set balance = balance + p_amount where user_id = p_user returning balance into v_bal;
  insert into fan_ledger(user_id, delta, reason, ref) values (p_user, p_amount, 'Admin: ' || trim(p_reason), 'admin');
  return v_bal;
end $$;

create or replace function public.fan_buy_item(p_item int) returns int
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); it fan_shop_items; v_bal int;
begin
  if v_uid is null then raise exception 'Prijavi se.'; end if;
  perform fan_ensure_wallet();
  select * into it from fan_shop_items where id = p_item and active;
  if not found then raise exception 'Artikal ne postoji.'; end if;
  if exists (select 1 from fan_inventory where user_id = v_uid and item_id = p_item) then
    raise exception 'Ovo već imaš.';
  end if;
  select balance into v_bal from fan_wallets where user_id = v_uid for update;
  if v_bal < it.price then raise exception 'Nemaš dovoljno poena.'; end if;

  update fan_inventory i
  set equipped=false
  from fan_shop_items s
  where i.user_id=v_uid and s.id=i.item_id and s.kind=it.kind;

  update fan_wallets set balance = balance - it.price where user_id = v_uid;
  insert into fan_inventory(user_id, item_id, equipped) values (v_uid, p_item, true);
  insert into fan_ledger(user_id, delta, reason, ref) values (v_uid, -it.price, 'Kupovina: ' || it.name, 'shop');
  return v_bal - it.price;
end $$;

create or replace function public.fan_equip_item(p_item int, p_on boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_kind text;
begin
  if v_uid is null then raise exception 'Prijavi se.'; end if;
  select s.kind into v_kind from fan_inventory i join fan_shop_items s on s.id = i.item_id
    where i.user_id = v_uid and i.item_id = p_item;
  if v_kind is null then raise exception 'Nemaš ovaj artikal.'; end if;
  if p_on then
    update fan_inventory i set equipped = false from fan_shop_items s
      where i.user_id = v_uid and s.id = i.item_id and s.kind = v_kind;
  end if;
  update fan_inventory set equipped = p_on where user_id = v_uid and item_id = p_item;
end $$;

create or replace function public.fan_mvp_vote(p_match text, p_player text, p_extra int default 0) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); mt record; v_bal int;
begin
  if v_uid is null then raise exception 'Prijavi se.'; end if;
  perform fan_ensure_wallet();
  select * into mt from matches where id::text = p_match;
  if not found or mt.status is distinct from 'finished' then raise exception 'Glasanje je moguće tek kad se utakmica završi.'; end if;
  if not exists (select 1 from players where id::text = p_player and team_id::text in (mt.home_team_id::text, mt.away_team_id::text)) then
    raise exception 'Taj igrač nije iz jedne od ekipa u ovoj utakmici.';
  end if;
  if exists (select 1 from match_players where match_id::text = p_match)
     and not exists (select 1 from match_players where match_id::text = p_match and player_id::text = p_player) then
    raise exception 'Taj igrač nije nastupio u ovoj utakmici.';
  end if;
  if exists (select 1 from fan_mvp_votes where match_id = p_match and voter = v_uid) then
    raise exception 'Već si glasao za ovu utakmicu.';
  end if;
  p_extra := greatest(0, least(coalesce(p_extra,0), 10));
  select balance into v_bal from fan_wallets where user_id = v_uid for update;
  if v_bal < p_extra then raise exception 'Nemaš dovoljno poena.'; end if;
  if p_extra > 0 then
    update fan_wallets set balance = balance - p_extra where user_id = v_uid;
    insert into fan_ledger(user_id, delta, reason, ref) values (v_uid, -p_extra, 'Pojačan MVP glas', p_match);
  end if;
  insert into fan_mvp_votes(match_id, voter, player_id, weight) values (p_match, v_uid, p_player, 1 + p_extra);
  return jsonb_build_object('balance', v_bal - p_extra);
end $$;

create or replace function public.fan_mvp_results(p_match text)
returns table(player_id text, votes bigint) language sql stable security definer set search_path = public as $$
  select player_id, sum(weight)::bigint from fan_mvp_votes where match_id = p_match group by player_id order by 2 desc;
$$;

create or replace function public.fan_team_donate(p_team text, p_amount int) returns int
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_bal int;
begin
  if v_uid is null then raise exception 'Prijavi se.'; end if;
  perform fan_ensure_wallet();
  if p_amount is null or p_amount < 1 or p_amount > 100 then raise exception 'Možeš pokloniti od 1 do 100 poena.'; end if;
  if not exists (select 1 from teams where id::text = p_team) then raise exception 'Ekipa ne postoji.'; end if;
  select balance into v_bal from fan_wallets where user_id = v_uid for update;
  if v_bal < p_amount then raise exception 'Nemaš dovoljno poena.'; end if;
  update fan_wallets set balance = balance - p_amount where user_id = v_uid;
  insert into fan_team_fund(team_id, total) values (p_team, p_amount)
    on conflict (team_id) do update set total = fan_team_fund.total + p_amount;
  insert into fan_ledger(user_id, delta, reason, ref) values (v_uid, -p_amount, 'Navijački fond ekipe', p_team);
  return v_bal - p_amount;
end $$;

-- Procenat navijača po ponudi (bez otkrivanja ko je šta pogodio)
create or replace function public.fan_market_stats(p_match text)
returns table(market_id uuid, picks bigint) language sql stable security definer set search_path = public as $$
  select market_id, count(*) from fan_picks where match_id = p_match group by market_id;
$$;

create or replace function public.fan_leaderboard()
returns table(user_id uuid, username text, balance int, picks bigint, won bigint, title text, name_color text, frame text)
language sql stable security definer set search_path = public as $$
  select w.user_id, p.username, w.balance,
    (select count(*) from fan_picks f where f.user_id = w.user_id and f.status in ('won','lost')),
    (select count(*) from fan_picks f where f.user_id = w.user_id and f.status = 'won'),
    (select s.value from fan_inventory i join fan_shop_items s on s.id = i.item_id where i.user_id = w.user_id and i.equipped and s.kind = 'title' limit 1),
    (select s.value from fan_inventory i join fan_shop_items s on s.id = i.item_id where i.user_id = w.user_id and i.equipped and s.kind = 'name_color' limit 1),
    (select s.value from fan_inventory i join fan_shop_items s on s.id = i.item_id where i.user_id = w.user_id and i.equipped and s.kind = 'frame' limit 1)
  from fan_wallets w join profiles p on p.id = w.user_id
  order by w.balance desc, 5 desc limit 50;
$$;

revoke all on function public.fan_ensure_wallet(), public.fan_claim_daily(),
  public.fan_place_pick(uuid,int,boolean), public.fan_generate_markets(text),
  public.fan_set_odds(uuid,numeric), public.fan_settle_match(text),
  public.fan_admin_grant(uuid,int,text), public.fan_buy_item(int),
  public.fan_equip_item(int,boolean), public.fan_mvp_vote(text,text,int),
  public.fan_team_donate(text,int) from public, anon;
grant execute on function public.fan_ensure_wallet(), public.fan_claim_daily(),
  public.fan_place_pick(uuid,int,boolean), public.fan_generate_markets(text),
  public.fan_set_odds(uuid,numeric), public.fan_settle_match(text),
  public.fan_admin_grant(uuid,int,text), public.fan_buy_item(int),
  public.fan_equip_item(int,boolean), public.fan_mvp_vote(text,text,int),
  public.fan_team_donate(text,int) to authenticated;
grant execute on function public.fan_leaderboard(), public.fan_mvp_results(text),
  public.fan_market_stats(text) to anon, authenticated;

-- ---------------------------------------------------- PRODAVNICA (početni artikli)
insert into public.fan_shop_items (kind, name, description, price, value)
select * from (values
  ('name_color','Zlatno ime','Ime zlatne boje u listi navijača',60,'#ffd23f'),
  ('name_color','Neon zeleno ime','Ime neon zelene boje',40,'#25e487'),
  ('name_color','Plavo ime','Ime hladno plave boje',40,'#4cc9f0'),
  ('frame','Zlatni okvir','Zlatni okvir oko tvog imena',80,'#ffd23f'),
  ('frame','Vatreni okvir','Crveno-narandžasti okvir',70,'#ff6b35'),
  ('badge','⚽ Strijelac','Bedž pored imena',30,'⚽'),
  ('badge','🔥 U formi','Bedž pored imena',30,'🔥'),
  ('badge','👑 Kralj tribine','Bedž pored imena',120,'👑'),
  ('title','Veteran lige','Titula ispod imena',50,'Veteran lige'),
  ('title','Stručnjak za futsal','Titula ispod imena',50,'Stručnjak za futsal'),
  ('title','Vjerni navijač','Titula ispod imena',35,'Vjerni navijač'),
  ('title','👑 VIP Legenda','Ekskluzivna rijetka titula za navijače koji su sakupili mnogo poena',5000,'VIP Legenda'),
  ('emoji_pack','🔥 Tribina','Brzi navijački emojiji za chat i komentare',90,'🔥,💚,⚽,👏'),
  ('emoji_pack','👑 Kraljevski','Ekskluzivni emoji paket za ozbiljne navijače',150,'👑,🏆,💥,🫡'),
  ('emoji_pack','😈 Ludilo','Paket za najluđu atmosferu na tribini',250,'😈,🤯,😂,🚀')
) as v(kind,name,description,price,value)
where not exists (select 1 from public.fan_shop_items);
revoke all on function public.fan_is_admin() from public, anon;
grant execute on function public.fan_is_admin() to authenticated;
