# Međasi Futsal Liga

PWA aplikacija za futsal ligu: utakmice uživo, tabela, ekipe, igrači, statistika, vijesti, galerija, chat i push obavještenja.

- **Frontend:** čisti HTML/CSS/JS (`index.html`, `css/`, `js/app.js`)
- **Backend:** Supabase (baza, autentifikacija, storage, realtime, funkcija `send-push`)
- **PWA:** `manifest.json` + `service-worker.js`

## Važno pri izmjeni koda
Kad promijeniš `js/app.js` ili `css/*.css`, povećaj broj verzije (`?v=...`) u `index.html` **i** u `service-worker.js`, te promijeni `CACHE_NAME`. Inače će korisnici i dalje dobijati staru keširanu verziju.