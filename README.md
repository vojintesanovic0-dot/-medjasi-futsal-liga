# Međasi Futsal Liga

PWA aplikacija za futsal ligu: utakmice uživo, tabela, ekipe, igrači, statistika, vijesti, galerija, chat i push obavještenja.

- **Frontend:** čisti HTML/CSS/JS (`index.html`, `css/`, `js/app.js`)
- **Backend:** Supabase (baza, autentifikacija, storage, realtime, Edge Functions `send-push` i `fan-admin-action`; njihove verzionisane kopije su u `supabase/functions/`)
- **PWA:** `manifest.json` + `service-worker.js`

## Važno pri izmjeni koda
Kad promijeniš `js/app.js` ili `css/*.css`, povećaj broj verzije (`?v=...`) u `index.html` **i** u `service-worker.js`, te promijeni `CACHE_NAME`. Inače će korisnici i dalje dobijati staru keširanu verziju.

## Finalna tehnička konsolidacija
- `sql/01_fan_game.sql` sada završava sigurnosnim hardeningom; novi deployment više ne zavisi od zasebnog koraka da bi Fan Game RPC-ovi bili premješteni u `private`.
- `sql/02_security_hardening.sql` ostaje kao idempotentni upgrade za postojeće baze.
- `js/ui-compat.js` sadrži legacy/community/profile UI kompatibilne patch-e izdvojene iz `js/app.js`; vizuelni sloj i postojeće animacije nisu mijenjani.
- **Supabase Auth:** uključi `Leaked Password Protection` u Dashboardu pod **Authentication → Password Security**; to je projektna postavka koja se ne mijenja kroz SQL skripte.


## SQL redoslijed pokretanja
1. `sql/00_core_schema_REFERENCE.sql` – opcionalna referenca; dodaje RLS samo tabelama koje nemaju nijednu politiku.
2. `sql/01_fan_game.sql`
3. `sql/02_security_hardening.sql`
4. `sql/03_rls_performance_hardening.sql`
5. `sql/04_runtime_hardening.sql`
6. `sql/05_rate_limit_and_audit.sql`
7. `sql/06_guard_admin_role_assignment_nulls.sql` – popravlja provjeru administratorske uloge za `NULL` slučajeve i sprečava slučajno uklanjanje posljednjeg administratora.
8. `sql/07_admin_rpc_wrapper.sql` – vraća javni invoker-wrapper za administratorsku dodjelu Fan Game poena, uz privatnu provjeru ovlaštenja.
9. `sql/08_recalculate_match_scores.sql` – održava rezultat tačnim nakon izmjene/brisanja gola ili promjene pripadnosti igrača/ekipa.
10. `sql/09_fan_pick_match_lock.sql` – zaključava utakmicu pa tržište istim redoslijedom kao finalizacija i ponovo čita kvotu/status prije prihvatanja pogotka.
11. `sql/10_enforce_message_identity.sql` – postavlja korisničko ime u chat porukama prema profilu, da klijent ne može glumiti drugog korisnika.
12. `sql/11_allow_community_reaction_updates.sql` – omogućava korisniku promjenu vlastite reakcije bez kršenja ograničenja jedne reakcije po objavi.
13. `sql/12_fan_set_odds_invoker_wrapper.sql` – vraća siguran invoker RPC za podešavanje kvota, uz provjeru administratorske uloge u privatnoj funkciji.
14. `sql/13_guard_match_status_and_market_generation.sql` – odbija utakmice s nedostajućim ekipama/statusom, nameće obavezne ID-jeve ekipa i status, te sprečava otvaranje novih Fan Game kvota nakon početka ili završetka utakmice.

## Novo u ovoj verziji
- `js/app.js`: paginirano čitanje velikih tabela, ograničeno učitavanje chata/komentara/galerije, debounce realtime osvježavanja, djelimično osvježavanje poruka/komentara i auth callback bez await deadlocka.
- `js/extras.js` + `css/extras.css`: statistika+ (strijelci, asistenti, fair play), .ics kalendar, dijeljenje rezultata kao slika, opciona tema i admin audit UI.
- `service-worker.js`: nova verzija cache-a, offline stranica i keširanje jsDelivr Supabase biblioteke.
- `supabase/functions/fan-admin-action/index.ts`: administratorski RPC pozivi koriste JWT stvarnog administratora kako bi provjere `auth.uid()` ostale ispravne.
- Vidljivi naziv lige je normalizovan na `Međasi` bez promjene tehničkih identifikatora i ruta.
