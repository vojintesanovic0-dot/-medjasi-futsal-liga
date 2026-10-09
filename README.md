# Međasi Futsal Liga

PWA aplikacija za futsal ligu: utakmice uživo, tabela, ekipe, igrači, statistika, vijesti, galerija, chat i push obavještenja.

- **Frontend:** čisti HTML/CSS/JS (`index.html`, `css/`, `js/app.js`)
- **Backend:** Supabase (baza, autentifikacija, storage, realtime, Edge Functions)
- **Edge Functions:** `supabase/functions/send-push` i `supabase/functions/fan-admin-action` – verzionisani izvori live funkcija; tajne ostaju u Supabase secrets.
- **PWA:** `manifest.json` + `service-worker.js`

## Važno pri izmjeni koda
Kad promijeniš `js/app.js` ili `css/*.css`, povećaj broj verzije (`?v=...`) u `index.html` **i** u `service-worker.js`, te promijeni `CACHE_NAME`. Inače će korisnici i dalje dobijati staru keširanu verziju.

## Finalna tehnička konsolidacija
- `sql/01_fan_game.sql` sadrži kanonski Fan Game sloj; postojeće baze dodatno prolaze kroz idempotentne hardening skripte.
- `sql/02_security_hardening.sql` ostaje kao upgrade za postojeće baze.
- `js/ui-compat.js` sadrži legacy/community/profile UI kompatibilne patch-e izdvojene iz `js/app.js`; vizuelni sloj i postojeće animacije nisu mijenjani.


## SQL redoslijed pokretanja

Pokreći skripte po redoslijedu navedenom ispod, nakon što osnovne tabele i kolone aplikacije već postoje. `sql/00_core_schema_REFERENCE.sql` je referentna skripta i nije zamjena za stvarnu baznu šemu.

1. `sql/01_fan_game.sql` – osnovne Fan Game funkcije i tabele.
2. `sql/02_security_hardening.sql` – sigurnosno učvršćivanje Fan Game sloja.
3. `sql/03_rls_performance_hardening.sql` – RLS/performance podešavanja.
4. `sql/04_runtime_hardening.sql` – runtime hardening.
5. `sql/05_rate_limit_and_audit.sql` – ograničenja slanja i audit.
6. `sql/06_admin_rpcs.sql` – osnovne, provjerene admin RPC implementacije.
7. `sql/07_admin_rpc_hardening.sql` – premješta privilegovane implementacije u `private` i ostavlja javne invoker omotače.
8. `sql/08_league_data_integrity.sql` – server-side integritet ligaških podataka.
9. `sql/09_runtime_event_sync.sql` – sinhronizacija golova, rezultata, događaja i završetka utakmice.
10. `sql/10_match_player_integrity.sql` – validacija postave i pripadnosti igrača ekipi.
11. `sql/11_fan_game_data_integrity.sql` – ograničenja kvota, tiketa i virtualnog novčanika.
12. `sql/12_fan_reprice_runtime_sync.sql` – promjena Fan Game kvota nakon događaja.
13. `sql/13_sensitive_data_api_privileges.sql` – minimalne privilegije za osjetljive tabele.
14. `sql/14_protect_profile_role.sql` – završna zaštita uloga profila i blokada retroaktivnih izmjena nakon settlementa.

`sql/06_admin_rpcs.sql` mora prethoditi RPC hardeningu, a `sql/14_protect_profile_role.sql` se namjerno pokreće na kraju jer koristi funkcije i trigere definisane ranije. Nemoj pokretati stare kopije ovih skripti iz vanjskih backup grana.

## Novo u ovoj verziji
- `js/app.js`: paginirano čitanje velikih tabela, ograničeno učitavanje chata/komentara/galerije, debounce realtime osvježavanja, djelimično osvježavanje poruka/komentara i auth callback bez await deadlocka.
- `js/extras.js` + `css/extras.css`: statistika+ (strijelci, asistenti, fair play), .ics kalendar, dijeljenje rezultata kao slika, opciona tema i admin audit UI.
- `service-worker.js`: nova verzija cache-a, offline stranica i keširanje jsDelivr Supabase biblioteke.
- Vidljivi naziv lige je normalizovan na `Međasi` bez promjene tehničkih identifikatora i ruta.


## Tehnička zaštita
- `profiles.role` nije direktno upisiv/izmjenjiv preko običnog klijenta; admin promjene idu kroz serversku funkciju.
- Završetak utakmice automatski pokreće Fan Game settlement kroz `medjasi_match_event`; frontend više nije izvor settlement logike.
- Nakon obračuna Fan Game tiketa, završena utakmica sa tiketima blokira retroaktivne izmjene golova, kartona i postave.
- Uploadi imaju centralnu MIME/size validaciju, a neuspjeli DB upisi i brisanja čiste povezane Storage objekte gdje je to moguće.
- GitHub Actions workflow `static-validation.yml` provjerava sintaksu svih JavaScript fajlova i prisustvo ključnih PWA fajlova.
