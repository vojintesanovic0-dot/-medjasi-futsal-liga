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
15. `sql/14_fix_fan_reprice_match_live_status_alias.sql` – ispravlja live preračunavanje kvota tako da koristi status same utakmice umjesto nepostojećeg aliasa.
16. `sql/15_validate_match_event_integrity.sql` – zahtijeva utakmicu i igrača na golu/kartonu te odbija strijelce/asistente/kartonisane igrače koji nisu iz ekipa te utakmice.
17. `sql/16_restrict_liga_images_uploads.sql` – ograničava Storage upload na dozvoljene medije, 50 MB po objektu i slike do 12 MB u korisničkim folderima; administratori zadržavaju video upload.
18. `sql/17_revoke_excess_public_table_privileges.sql` – uklanja nepotrebne privilegije za `anon` i privilegije održavanja za klijentske uloge, zadržavajući postojeće RLS i autentifikovane CRUD tokove.
19. `sql/18_tighten_public_dml_and_sequence_grants.sql` – uklanja direktne INSERT/UPDATE/DELETE dozvole bez odgovarajuće RLS politike, sužava pristup sekvencama i postavlja minimalne podrazumijevane privilegije za nove tabele.
20. `sql/19_revoke_default_function_execute.sql` – uklanja automatsko `EXECUTE` za `PUBLIC`, `anon` i `authenticated` na budućim funkcijama koje kreira `postgres`; dozvole postojećih funkcija ostaju iste.
21. `sql/20_revoke_public_math_helper_execute.sql` – uklanja javni RPC pristup internim funkcijama za Poisson vjerovatnoću i pretvaranje vjerovatnoće u kvotu; interni preračun kvota ostaje nepromijenjen.
22. `sql/21_allow_admin_gallery_news_media.sql` – omogućava isključivo administratorima upload slika/videa u galeriju i vijesti te brisanje njihovih Storage objekata; obični korisnički folderi ostaju ograničeni.
23. `sql/22_revoke_unneeded_anon_select.sql` – uklanja direktni `SELECT` grant za anonimnu ulogu sa tabela čije RLS politike dozvoljavaju čitanje samo prijavljenim korisnicima.
24. `sql/23_remove_duplicate_profile_role_trigger.sql` – uklanja zastarjeli dupli okidač za promjenu uloge profila; noviji `trg_protect_profile_role` ostaje jedina provjera koja štiti korisničke zahtjeve i dopušta pouzdani SQL Editor kontekst.
25. `sql/24_public_league_snapshot_rpc.sql` – objedinjuje javno čitanje podataka lige u jedan `SECURITY INVOKER` RPC, čuva postojeće RLS politike i smanjuje broj REST konekcija pri početnom učitavanju.
26. `sql/25_enforce_single_active_season.sql` – uvodi parcijalni jedinstveni indeks koji dozvoljava najviše jednu aktivnu sezonu; prije izmjene provjerava postojeće stanje i prekida ako su aktivne duplikatne sezone.
27. `sql/26_create_profile_for_auth_users.sql` – automatski pravi običan profil nakon registracije, uključujući naloge koji čekaju potvrdu e-maila, i popunjava samo profile koji nedostaju; nikada ne kopira administratorsku ulogu iz korisničkih metapodataka.
28. `sql/27_handle_profile_username_collisions.sql` – pri registraciji pokušava siguran rezervni naziv ako je željeno korisničko ime zauzeto; mijenja samo trigger funkciju i ne dira postojeće profile.
29. `sql/28_harden_push_config.sql` – uključuje RLS na tabeli `push_config` i uklanja pristup browser ulogama kako VAPID privatni ključ ne bi bio dostupan klijentu; koristi je samo pouzdani server-side service role.
- `scripts/check-live-supabase.mjs` i `.github/workflows/live-supabase-health.yml`: zasebna provjera produkcijskog snapshot API-ja; ne miješa dostupnost Supabase-a s UI regresijskim testovima.
- Status poruka za nedostupni Data API ima razmake između naslova, objašnjenja i dugmeta, pa je čitljiva i u pristupačnom tekstualnom prikazu.
- Registracija normalizuje korisnička imena i provjerava zauzetost bez blokiranja prijave kada je Data API privremeno nedostupan; server-side trigger ostaje konačna zaštita od duplikata.

## Novo u ovoj verziji
- `js/app.js`: paginirano čitanje velikih tabela, objedinjeni league snapshot RPC, timeout/backoff pri greškama baze, lokalna kopija posljednjih uspješno učitanih podataka, ograničeno učitavanje chata/komentara/galerije, debounce realtime osvježavanja i auth callback bez await deadlocka.
- `js/extras.js` + `css/extras.css`: statistika+ (strijelci, asistenti, fair play), dijeljenje rezultata kao slika i admin audit UI. Prekidač svijetle/tamne teme uklonjen je iz korisničkog interfejsa; postojeća tamna tema ostaje.
- `js/growth.js`: deduplicirano učitavanje „Liga info“ podataka, timeouti i eksponencijalni backoff pri greškama API-ja; čuva prethodne rezultate, ujednačava sortiranje tabele i prikaza „Liga info“, te sigurnije izvozi .ics kalendar i odbacuje neispravne datume.
- `service-worker.js`: nova verzija cache-a, offline stranica i keširanje jsDelivr Supabase biblioteke.
- `supabase/functions/fan-admin-action/index.ts`: administratorski RPC pozivi koriste JWT stvarnog administratora kako bi provjere `auth.uid()` ostale ispravne.
- `supabase/functions/send-push/index.ts`: push naslov koristi pravilan naziv lige, tip obavijesti dolazi iz provjerene vrijednosti, a `match_id` ima ograničenu dužinu. Nakon odobrenja promjena potrebno je deployati Edge funkciju da izmjene važe u produkciji.
- Vidljivi naziv lige je normalizovan na `Međasi` bez promjene tehničkih identifikatora i ruta.

- Trenutna grana osvježava `index.html` i Service Worker ključeve pri relevantnim izmjenama; trenutno su `app.js?v=20261013v58`, `growth.js?v=20261012v02`, `css/medjasi-mobile-v2.css?v=20261013v18` i PWA cache `medjasi-futsal-pwa-v201`.
