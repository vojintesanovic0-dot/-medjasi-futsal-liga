# Međasi Futsal Liga

PWA aplikacija za futsal ligu: utakmice uživo, tabela, ekipe, igrači, statistika, vijesti, galerija, chat i push obavještenja.

- **Frontend:** čisti HTML/CSS/JS (`index.html`, `css/`, `js/app.js`)
- **Backend:** Supabase (baza, autentifikacija, storage, realtime, Edge Functions)
- **Edge Functions:** `supabase/functions/send-push` i `supabase/functions/fan-admin-action` – verzionisani izvori live funkcija; tajne ostaju u Supabase secrets.
- **PWA:** `manifest.json` + `service-worker.js`

## Važno pri izmjeni koda
Kad promijeniš `js/app.js` ili `css/*.css`, povećaj broj verzije (`?v=...`) u `index.html` **i** u `service-worker.js`, te promijeni `CACHE_NAME`. Inače će korisnici i dalje dobijati staru keširanu verziju.

## Finalna tehnička konsolidacija
- `sql/01_fan_game.sql` sada završava sigurnosnim hardeningom; novi deployment više ne zavisi od zasebnog koraka da bi Fan Game RPC-ovi bili premješteni u `private`.
- `sql/02_security_hardening.sql` ostaje kao idempotentni upgrade za postojeće baze.
- `js/ui-compat.js` sadrži legacy/community/profile UI kompatibilne patch-e izdvojene iz `js/app.js`; vizuelni sloj i postojeće animacije nisu mijenjani.


## SQL redoslijed pokretanja
1. `sql/00_core_schema_REFERENCE.sql` – opcionalna referenca; dodaje RLS samo tabelama koje nemaju nijednu politiku.
2. `sql/01_fan_game.sql`
3. `sql/02_security_hardening.sql`
4. `sql/03_rls_performance_hardening.sql`
5. `sql/04_runtime_hardening.sql`
6. `sql/05_rate_limit_and_audit.sql`
7. `sql/06_protect_profile_role.sql` – zaključava `profiles.role`, štiti privilegije profila i čuva Fan Game settlement integritet.
8. `sql/07_admin_rpc_hardening.sql` – premješta admin `SECURITY DEFINER` implementacije u `private` i ostavlja iste javne invoker RPC nazive za postojeći Admin UI.

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
